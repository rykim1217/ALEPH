import {STUDY_KEY,lectureItems} from './study.js';

// Raw strings are authoritative: preserve unknown fields and malformed values too.
export function createPaceBackup(storage,createdAt=new Date().toISOString()){
 const rawStorage={};
 for(let index=0;index<storage.length;index++){
  const key=storage.key(index);
  if(key?.startsWith('pace.'))rawStorage[key]=storage.getItem(key);
 }
 if(!Object.keys(rawStorage).length)throw new Error('내보낼 PACE 저장 데이터가 없습니다.');
 const warnings=[];let resolvedStudyItems=[];
 if(rawStorage[STUDY_KEY]!=null){
  try{resolvedStudyItems=lectureItems(JSON.parse(rawStorage[STUDY_KEY]));}
  catch{warnings.push('학습 데이터 해석에 실패했습니다. localStorage 원문은 그대로 포함되어 있습니다.');}
 }
 return {format:'pace-local-backup',version:1,createdAt,rawStorage,resolvedStudyItems,warnings};
}

export function downloadPaceBackup(storage){
 const backup=createPaceBackup(storage);
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='pace-backup-'+backup.createdAt.replace(/[:.]/g,'-')+'.json';
 document.body.append(link);
 try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 return backup;
}
