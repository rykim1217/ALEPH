import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getSQL, ensureSchema, getOrCreateDemoUser, requestedAccount } from '../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });
  try {
    const sql = getSQL();
    await ensureSchema(sql);
    const user = await getOrCreateDemoUser(sql, requestedAccount(req));
    const existing = await sql`SELECT credential_id, transports FROM t08_passkeys WHERE user_id=${user.id}`;
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0];
    const rpID = host || 'localhost';
    const options = await generateRegistrationOptions({
      rpName: 'KIM RAYEON PORTFOLIO',
      rpID,
      userName: user.id,
      userDisplayName: user.display_name,
      userID: Buffer.from(user.webauthn_user_id, 'base64url'),
      attestationType: 'none',
      // 학원 PC에 Windows Hello가 없어도 개인 휴대폰으로 등록할 수 있도록
      // WebAuthn hybrid(교차 기기) 흐름을 우선 안내한다.
      excludeCredentials: existing.map(p => ({
        id: p.credential_id,
        transports: p.transports ? p.transports.split(',').filter(Boolean) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });
    await sql`INSERT INTO t08_challenges(user_id, challenge, kind, created_at)
      VALUES(${user.id}, ${options.challenge}, ${'registration'}, NOW())
      ON CONFLICT(user_id) DO UPDATE SET challenge=EXCLUDED.challenge, kind=EXCLUDED.kind, created_at=NOW()`;
    return res.status(200).json({ ok:true, options });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ ok:false, error:error.message || 'REGISTRATION_OPTIONS_FAILED' });
  }
}
