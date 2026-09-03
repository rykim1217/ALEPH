import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getSQL, ensureSchema, getOrCreateDemoUser, requestedAccount } from '../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });
  try {
    const name = String(req.body?.name || '').trim().slice(0, 40);
    const credential = req.body?.credential;
    if (!name || !credential) return res.status(400).json({ ok:false, error:'NAME_AND_CREDENTIAL_REQUIRED' });
    const sql = getSQL();
    await ensureSchema(sql);
    const user = await getOrCreateDemoUser(sql, requestedAccount(req));
    const rows = await sql`SELECT challenge, kind FROM t08_challenges WHERE user_id=${user.id}`;
    if (!rows.length || rows[0].kind !== 'registration') return res.status(400).json({ ok:false, error:'REGISTRATION_CHALLENGE_NOT_FOUND' });
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0];
    const proto = req.headers['x-forwarded-proto'] || (host === 'localhost' ? 'http' : 'https');
    const expectedOrigin = `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: rows[0].challenge,
      expectedOrigin,
      expectedRPID: host || 'localhost',
      requireUserVerification: false,
    });
    if (!verification.verified || !verification.registrationInfo) return res.status(400).json({ ok:false, error:'REGISTRATION_NOT_VERIFIED' });
    const info = verification.registrationInfo;
    const c = info.credential;
    const publicKey = Buffer.from(c.publicKey).toString('base64url');
    const transports = credential.response?.transports?.join(',') || null;
    await sql`INSERT INTO t08_passkeys(credential_id,user_id,name,public_key,counter,device_type,backed_up,transports)
      VALUES(${c.id},${user.id},${name},${publicKey},${c.counter},${info.credentialDeviceType || null},${Boolean(info.credentialBackedUp)},${transports})`;
    await sql`DELETE FROM t08_challenges WHERE user_id=${user.id}`;
    return res.status(200).json({ ok:true, verified:true, saved:{ name, credentialId:c.id, publicKey, createdAt:new Date().toISOString() } });
  } catch (error) {
    return res.status(400).json({ ok:false, error:error.message || 'REGISTRATION_VERIFY_FAILED' });
  }
}
