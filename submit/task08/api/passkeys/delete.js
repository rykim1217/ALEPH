import { getSQL, ensureSchema, getSessionUser } from '../_lib/db.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='DELETE') return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  try{
    const sql=getSQL();
    await ensureSchema(sql);
    const sessionUser=await getSessionUser(req,sql);
    if(!sessionUser) return res.status(401).json({ok:false,error:'AUTHENTICATION_REQUIRED',message:'패스키를 삭제하려면 먼저 로그인해야 합니다.'});
    const credentialId=String(req.body?.credentialId||'').trim();
    if(!credentialId) return res.status(400).json({ok:false,error:'CREDENTIAL_ID_REQUIRED'});
    const rows=await sql`DELETE FROM t08_passkeys WHERE credential_id=${credentialId} AND user_id=${sessionUser.user_id} RETURNING name`;
    if(!rows.length) return res.status(404).json({ok:false,error:'PASSKEY_NOT_FOUND'});
    const left=await sql`SELECT COUNT(*)::int AS count FROM t08_passkeys WHERE user_id=${sessionUser.user_id}`;
    return res.status(200).json({ok:true,deletedName:rows[0].name,remaining:left[0]?.count||0,message:(left[0]?.count||0)===0?'남은 패스키가 없습니다. 새 패스키를 등록해야 다시 로그인할 수 있습니다.':'패스키를 삭제했습니다.'});
  }catch(error){ return res.status(error.statusCode||500).json({ok:false,error:error.message||'PASSKEY_DELETE_FAILED'}); }
}
