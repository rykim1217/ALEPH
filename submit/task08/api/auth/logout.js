import { getSQL, ensureSchema, readSessionToken, tokenHash } from '../_lib/db.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  try{ const sql=getSQL(); await ensureSchema(sql); const token=readSessionToken(req); if(token) await sql`DELETE FROM t08_sessions WHERE token_hash=${tokenHash(token)}`; res.setHeader('Set-Cookie','t08_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'); return res.status(200).json({ok:true}); }
  catch(error){ return res.status(error.statusCode||500).json({ok:false,error:error.message||'LOGOUT_FAILED'}); }
}
