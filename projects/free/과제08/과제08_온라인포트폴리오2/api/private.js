import { getSQL, ensureSchema, getSessionUser } from './_lib/db.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  try{
    const sql=getSQL(); await ensureSchema(sql); const user=await getSessionUser(req,sql);
    if(!user) return res.status(401).json({ok:false,error:'AUTHENTICATION_REQUIRED',message:'패스키 인증이 필요한 비공개 자료입니다.'});
    const rows=await sql`SELECT category,position,content FROM t08_private_items WHERE user_id=${user.user_id} ORDER BY category,position`;
    const data={portfolio:[],learning:[],schedule:[]}; for(const row of rows) if(data[row.category]) data[row.category].push(row.content);
    const requested=String(req.query?.account||'').trim()||null;
    return res.status(200).json({ok:true,authorization:'session-user-only',sessionAccount:user.user_id,requestedAccount:requested,requestedAccountIgnored:Boolean(requested&&requested!==user.user_id),itemCount:rows.length,data});
  }catch(error){ return res.status(error.statusCode||500).json({ok:false,error:error.message||'PRIVATE_DATA_FAILED'}); }
}
