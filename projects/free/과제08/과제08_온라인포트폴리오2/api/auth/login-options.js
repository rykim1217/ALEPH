import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getSQL, ensureSchema, getOrCreateDemoUser, requestedAccount } from '../_lib/db.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  try{
    const sql=getSQL(); await ensureSchema(sql); const user=await getOrCreateDemoUser(sql, requestedAccount(req));
    const keys=await sql`SELECT credential_id, transports FROM t08_passkeys WHERE user_id=${user.id} ORDER BY created_at`;
    if(!keys.length) return res.status(409).json({ok:false,error:'NO_PASSKEY_REGISTERED',message:'먼저 패스키를 등록해 주세요.'});
    const host=(req.headers['x-forwarded-host']||req.headers.host||'').split(':')[0];
    const options=await generateAuthenticationOptions({
      rpID:host||'localhost',
      userVerification:'preferred',
      allowCredentials:keys.map(k=>({id:k.credential_id,transports:k.transports?k.transports.split(',').filter(Boolean):undefined}))
    });
    await sql`INSERT INTO t08_challenges(user_id,challenge,kind,created_at)
      VALUES(${user.id},${options.challenge},${'authentication'},NOW())
      ON CONFLICT(user_id) DO UPDATE SET challenge=EXCLUDED.challenge,kind=EXCLUDED.kind,created_at=NOW()`;
    return res.status(200).json({ok:true,options});
  }catch(error){ return res.status(error.statusCode||500).json({ok:false,error:error.message||'AUTH_OPTIONS_FAILED'}); }
}
