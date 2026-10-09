import crypto from 'node:crypto';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getSQL, ensureSchema, getOrCreateDemoUser, requestedAccount, tokenHash } from '../_lib/db.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  try{
    const credential=req.body?.credential;
    if(!credential?.id) return res.status(400).json({ok:false,error:'CREDENTIAL_REQUIRED'});
    const sql=getSQL(); await ensureSchema(sql); const user=await getOrCreateDemoUser(sql, requestedAccount(req));
    const ch=await sql`SELECT challenge,kind FROM t08_challenges WHERE user_id=${user.id}`;
    if(!ch.length||ch[0].kind!=='authentication') return res.status(400).json({ok:false,error:'AUTH_CHALLENGE_NOT_FOUND_OR_USED'});
    const rows=await sql`SELECT * FROM t08_passkeys WHERE credential_id=${credential.id} AND user_id=${user.id}`;
    if(!rows.length) return res.status(401).json({ok:false,error:'PASSKEY_NOT_REGISTERED'});
    const key=rows[0];
    const host=(req.headers['x-forwarded-host']||req.headers.host||'').split(':')[0];
    const proto=req.headers['x-forwarded-proto']||(host==='localhost'?'http':'https');
    const expectedOrigin=`${proto}://${req.headers['x-forwarded-host']||req.headers.host}`;
    const verification=await verifyAuthenticationResponse({
      response:credential,
      expectedChallenge:ch[0].challenge,
      expectedOrigin,
      expectedRPID:host||'localhost',
      credential:{id:key.credential_id,publicKey:Buffer.from(key.public_key,'base64url'),counter:Number(key.counter),transports:key.transports?key.transports.split(',').filter(Boolean):undefined},
      requireUserVerification:false
    });
    // Challenge is one-time: consume it after a verification attempt with a known credential.
    await sql`DELETE FROM t08_challenges WHERE user_id=${user.id} AND kind=${'authentication'}`;
    if(!verification.verified) return res.status(401).json({ok:false,error:'AUTHENTICATION_NOT_VERIFIED'});
    await sql`UPDATE t08_passkeys SET counter=${verification.authenticationInfo.newCounter} WHERE credential_id=${key.credential_id}`;
    const token=crypto.randomBytes(32).toString('base64url');
    const hash=tokenHash(token);
    await sql`DELETE FROM t08_sessions WHERE expires_at <= NOW()`;
    await sql`INSERT INTO t08_sessions(token_hash,user_id,expires_at) VALUES(${hash},${user.id},NOW()+INTERVAL '8 hours')`;
    res.setHeader('Set-Cookie',`t08_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);
    return res.status(200).json({ok:true,verified:true,message:'패스키 인증에 성공했습니다.'});
  }catch(error){ return res.status(401).json({ok:false,error:error.message||'AUTHENTICATION_VERIFY_FAILED'}); }
}
