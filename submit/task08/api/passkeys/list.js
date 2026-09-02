import { getSQL, ensureSchema, getOrCreateDemoUser, requestedAccount } from '../_lib/db.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  try{
    const sql=getSQL(); await ensureSchema(sql); const user=await getOrCreateDemoUser(sql, requestedAccount(req));
    const rows=await sql`SELECT name, credential_id, public_key, created_at FROM t08_passkeys WHERE user_id=${user.id} ORDER BY created_at DESC`;
    return res.status(200).json({ok:true, storage:'서버 DB에는 공개키만 저장합니다. 개인키는 기기의 패스키 저장소를 벗어나지 않습니다.', passkeys:rows.map(r=>({name:r.name,credentialId:r.credential_id,publicKey:r.public_key,createdAt:r.created_at}))});
  }catch(error){ return res.status(error.statusCode||500).json({ok:false,error:error.message||'PASSKEY_LIST_FAILED'}); }
}
