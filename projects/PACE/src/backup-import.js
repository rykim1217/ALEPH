import {STUDY_KEY,loadStudy,lectureItems,materializeSavedStudy} from './study.js';
import {loadCertifications} from './certifications.js';
import {loadAvailability,loadScopedAvailability,validDate} from './availability.js';
import {loadPlanning} from './study-planning.js';
import {loadDistributionSettings,validateCountSettings} from './distribution-settings.js';
import {downloadPaceBackup} from './backup.js';
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function paceStorageSnapshot(storage){const entries=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith('pace.'))entries.push([key,storage.getItem(key)]);}return JSON.stringify(entries.sort(([a],[b])=>a.localeCompare(b)));}
export function validatePaceBackup(text){
 if(typeof text!=='string'||text.length>20*1024*1024)throw Error('20MB 이하의 JSON 백업 파일을 선택해 주세요.');
 let backup;try{backup=JSON.parse(text);}catch{throw Error('올바른 JSON 파일이 아닙니다.');}
 if(backup?.format!=='pace-local-backup'||backup.version!==1||!object(backup.rawStorage))throw Error('지원하는 PACE 백업 형식이 아닙니다.');
 const raw=Object.fromEntries(Object.entries(backup.rawStorage));if(!Object.keys(raw).length||Object.entries(raw).some(([key,value])=>!key.startsWith('pace.')||typeof value!=='string'))throw Error('백업 저장값 형식을 확인해 주세요.');
 if(!raw[STUDY_KEY]||!raw['pace.certifications.v1'])throw Error('학습 데이터와 자격증 목록이 포함된 백업이 필요합니다.');
 // Disallow prototype-shaped payloads before any data enters the application.
 for(const value of Object.values(raw)){try{JSON.parse(value,(key,item)=>{if(['__proto__','constructor','prototype'].includes(key))throw Error('허용하지 않는 데이터 필드입니다.');return item;});}catch{throw Error('백업 저장값에 유효하지 않은 JSON 또는 필드가 있습니다.');}}
 const storage={getItem:key=>raw[key]??null},plans=loadCertifications(storage,[]),planIds=new Set(plans.map(plan=>plan.id)),data=loadStudy(storage);
 if(!object(data.completion)||!object(data.speeds)||(data.lectureCompletion!==undefined&&!object(data.lectureCompletion))||(data.itemOverrides!==undefined&&!object(data.itemOverrides))||(data.catalog!==undefined&&!Array.isArray(data.catalog)))throw Error('학습 기록 형식을 확인해 주세요.');
 const all=[...data.records,...(data.catalog||[])];if(all.some(item=>!object(item)||typeof item.id!=='string'||!item.id||!planIds.has(item.planId)||(item.date!=null&&!validDate(item.date))))throw Error('학습 항목 ID·자격증·날짜를 확인해 주세요.');
 if(new Set(all.map(item=>item.id)).size!==all.length)throw Error('학습 항목 ID가 중복되었습니다.');
 for(const item of data.catalog||[]){if(typeof item.title!=='string'||!item.title.trim()||typeof item.category!=='string'||!item.category.trim()||(item.expectedMinutes!=null&&(!Number.isFinite(item.expectedMinutes)||item.expectedMinutes<=0))||(item.originalSeconds!=null&&(!Number.isFinite(item.originalSeconds)||item.originalSeconds<=0)))throw Error('학습 항목 이름·분류·예상 시간을 확인해 주세요.');}
 for(const map of [data.completion,data.lectureCompletion||{}])if(Object.values(map).some(entry=>!object(entry)||typeof entry.completed!=='boolean'))throw Error('완료 기록 형식을 확인해 주세요.');
 if(Object.values(data.speeds).some(value=>!Number.isFinite(value)||value<=0))throw Error('배속 설정을 확인해 주세요.');
 for(const override of Object.values(data.itemOverrides||{}))if(!object(override)||(override.date!=null&&!validDate(override.date))||(override.completed!==undefined&&typeof override.completed!=='boolean'))throw Error('학습 항목 변경 기록을 확인해 주세요.');
 const settings=[loadPlanning(storage),loadDistributionSettings(storage),loadScopedAvailability(storage)];loadAvailability(storage);
 for(const setting of settings)if(Object.keys(setting.certifications).some(id=>!planIds.has(id)))throw Error('설정의 자격증 연결을 확인해 주세요.');
 for(const value of Object.values(settings[1].certifications)){if(value.countBased!==undefined)validateCountSettings(value.countBased);if(value.examPrep!==undefined&&(!Array.isArray(value.examPrep)||value.examPrep.some(ref=>!ref||typeof ref.itemId!=='string'||!Number.isSafeInteger(ref.daysBefore)||ref.daysBefore<1)))throw Error('시험 직전 항목 설정을 확인해 주세요.');}
 const personal=JSON.parse(raw['pace.personal-events.v1']||'[]');if(!Array.isArray(personal)||personal.some(event=>!object(event)||typeof event.id!=='string'||typeof event.title!=='string'||!event.title.trim()||!validDate(event.date)))throw Error('개인 일정 형식을 확인해 주세요.');
 const items=lectureItems(data);if(items.some(item=>!planIds.has(item.planId)||typeof item.title!=='string'||!item.title.trim()||typeof item.category!=='string'||!item.category.trim()||(item.date!=null&&!validDate(item.date))||(item.expectedMinutes!=null&&(!Number.isFinite(item.expectedMinutes)||item.expectedMinutes<=0))||(item.originalSeconds!=null&&(!Number.isFinite(item.originalSeconds)||item.originalSeconds<=0))))throw Error('변경 기록을 반영한 학습 항목이 유효하지 않습니다.');if(new Set(items.map(item=>item.id)).size!==items.length)throw Error('해석된 학습 항목 ID가 중복되었습니다.');
 if(backup.resolvedStudyItems!==undefined){if(!Array.isArray(backup.resolvedStudyItems))throw Error('백업 항목 목록 형식을 확인해 주세요.');const saved=new Map(backup.resolvedStudyItems.map(item=>[item.id,item]));if(saved.size!==items.length||items.some(item=>{const old=saved.get(item.id);return !old||old.planId!==item.planId||old.title!==item.title||old.date!==item.date||old.completed!==item.completed;}))throw Error('백업 원문과 학습 항목 목록이 일치하지 않습니다.');}
 const next=materializeSavedStudy(data);if(next!==data)raw[STUDY_KEY]=JSON.stringify(next);
 return {rawStorage:raw,plans,items:items.length,completed:items.filter(item=>item.completed).length,scheduled:items.filter(item=>item.date).length,personal:personal.length,certifications:plans.map(plan=>({name:plan.name,examDate:plan.examDate,count:items.filter(item=>item.planId===plan.id).length}))};
}
export function importPaceBackup(storage,prepared,{expectedSnapshot,confirmed=false}={}){
 if(!confirmed)throw Error('가져오기 확인이 필요합니다.');const current=paceStorageSnapshot(storage);if(current!==expectedSnapshot)throw Error('현재 데이터가 변경되었습니다. 파일을 다시 선택해 주세요.');const previous=new Map(JSON.parse(current));
 // Revalidate immediately before writing, rather than trusting mutable preview state.
 const next=validatePaceBackup(JSON.stringify({format:'pace-local-backup',version:1,rawStorage:prepared.rawStorage})).rawStorage;
 const keys=new Set([...previous.keys(),...Object.keys(next)]);
 try{for(const key of keys){if(Object.hasOwn(next,key))storage.setItem(key,next[key]);else storage.removeItem(key);}}
 catch(error){let failed=false;for(const key of keys){try{if(previous.has(key))storage.setItem(key,previous.get(key));else storage.removeItem(key);}catch{failed=true;}}throw Error(failed?'저장과 되돌리기에 실패했습니다. 다운로드한 기존 백업을 보관해 주세요.':'저장에 실패하여 기존 데이터를 되돌렸습니다.');}
}
export function initBackupImport({openButton,storage}){
 const dialog=document.createElement('dialog');dialog.className='backup-import-dialog';dialog.setAttribute('aria-label','백업 파일 가져오기');document.body.append(dialog);
 openButton.onclick=()=>{let prepared=null,snapshot=paceStorageSnapshot(storage);const existing=JSON.parse(snapshot).length>0;dialog.replaceChildren();
 const head=document.createElement('div');head.className='dialog-top';const title=document.createElement('h2');title.textContent='백업 파일 가져오기';const close=document.createElement('button');close.setAttribute('aria-label','백업 가져오기 닫기');close.type='button';close.className='icon-button';close.textContent='×';close.onclick=()=>dialog.close();head.append(title,close);
 const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','PACE JSON 백업 파일');const preview=document.createElement('div'),status=document.createElement('p');status.setAttribute('role','status');status.className='backup-import-status';
 const warning=document.createElement('p');warning.className='backup-import-notice';warning.textContent=existing?'기존 PACE 데이터가 있습니다. 가져오면 선택한 백업 내용으로 교체됩니다.':'백업 파일을 선택하고 내용을 확인한 뒤 가져와 주세요.';
 const download=document.createElement('button');download.type='button';download.textContent='현재 데이터 백업 다운로드';download.hidden=!existing;
 const consentLabel=document.createElement('label'),consent=document.createElement('input');consent.type='checkbox';consentLabel.append(consent,existing?' 기존 데이터를 위 백업 내용으로 교체하는 데 동의합니다.':' 위 백업 데이터를 가져오겠습니다.');
 const readiness=document.createElement('p');readiness.className='backup-import-readiness';readiness.setAttribute('role','status');const actions=document.createElement('div');actions.className='certification-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>dialog.close();const apply=document.createElement('button');apply.type='button';apply.textContent='백업 가져오기';apply.disabled=true;const update=()=>{apply.disabled=!prepared||!consent.checked;consent.disabled=!prepared;readiness.textContent=!prepared?'가져올 JSON 파일을 선택해 주세요.':!consent.checked?'아래 가져오기 동의를 체크해 주세요.':'준비 완료. 백업 가져오기를 누르면 적용됩니다.';};
 file.onchange=async()=>{prepared=null;consent.checked=false;preview.replaceChildren();update();const selected=file.files?.[0];if(!selected)return;try{if(selected.size>20*1024*1024)throw Error('20MB 이하의 파일을 선택해 주세요.');const text=await selected.text();if(file.files?.[0]!==selected)return;if(paceStorageSnapshot(storage)!==snapshot)throw Error('현재 데이터가 변경되었습니다. 팝업을 다시 열어 주세요.');prepared=validatePaceBackup(text);const summary=document.createElement('p');summary.textContent='자격증 '+prepared.plans.length+'개 · 학습 항목 '+prepared.items+'개 · 완료 '+prepared.completed+'개 · 날짜 배정 '+prepared.scheduled+'개 · 개인 일정 '+prepared.personal+'개';preview.append(summary);for(const plan of prepared.certifications){const row=document.createElement('p');row.textContent=plan.name+' · '+(plan.examDate||'시험일 미정')+' · '+plan.count+'개';preview.append(row);}status.textContent='검증 완료. 아직 실제 데이터는 변경되지 않았습니다.';update();}catch(error){status.textContent=error.message;}};
 download.onclick=()=>{try{if(paceStorageSnapshot(storage)!==snapshot)throw Error('현재 데이터가 변경되었습니다. 팝업을 다시 열어 주세요.');downloadPaceBackup(storage);status.textContent='다운로드를 요청했습니다. 실제 파일 저장 여부는 앱에서 확인할 수 없습니다. 필요하면 다운로드한 파일이 저장됐는지 확인해 주세요.';update();}catch(error){status.textContent='백업 다운로드 실패: '+error.message;}};
 consent.onchange=update;apply.onclick=()=>{try{importPaceBackup(storage,prepared,{expectedSnapshot:snapshot,confirmed:consent.checked});apply.disabled=true;status.textContent='가져오기 완료. 화면을 새로 불러옵니다.';location.reload();}catch(error){status.textContent=error.message;}};
 const section=(label)=>{const box=document.createElement('section');box.className='backup-import-step';const heading=document.createElement('h3');heading.textContent=label;box.append(heading);return box;};
 const backupStep=section('현재 데이터 백업 · 선택 사항');backupStep.hidden=!existing;backupStep.append(download);
 const fileStep=section('1. 가져올 파일 선택'),fileRow=document.createElement('div'),choose=document.createElement('button'),filename=document.createElement('span');fileRow.className='backup-import-file';choose.type='button';choose.textContent='JSON 파일 선택';choose.onclick=()=>file.click();filename.textContent='선택된 파일 없음';filename.className='backup-import-filename';file.hidden=true;file.addEventListener('change',()=>{filename.textContent=file.files?.[0]?.name||'선택된 파일 없음';});fileRow.append(choose,filename,file);preview.className='backup-import-preview';fileStep.append(fileRow,preview);
 const confirmStep=section('2. 내용 확인 후 가져오기');confirmStep.append(consentLabel,readiness);
 actions.append(cancel,apply);dialog.append(head,warning,backupStep,fileStep,confirmStep,status,actions);update();dialog.showModal();};
 dialog.onclick=event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();};
}
