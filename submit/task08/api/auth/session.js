import { getSQL, ensureSchema, getSessionUser } from '../_lib/db.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  try{ const sql=getSQL(); await ensureSchema(sql); const user=await getSessionUser(req,sql); return res.status(200).json({ok:true,authenticated:Boolean(user),user:user?{displayName:user.display_name}:null}); }
  catch(error){ return res.status(error.statusCode||500).json({ok:false,error:error.message||'SESSION_CHECK_FAILED'}); }
}
