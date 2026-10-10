import {lectureItems} from './study.js';
import {orderedCategories} from './category-order.js';
export const DISTRIBUTION_KEY='pace.distribution-settings.v1';
export function loadDistributionSettings(storage){const raw=storage.getItem(DISTRIBUTION_KEY);if(raw===null)return {version:1,certifications:{}};const data=JSON.parse(raw);if(data.version!==1||!data.certifications||typeof data.certifications!=='object'||Array.isArray(data.certifications)||Object.values(data.certifications).some(value=>!Array.isArray(value?.priority)||(value.mode!==undefined&&!['sequential','parallel'].includes(value.mode))||value.priority.some(ref=>typeof ref.category!=='string'||!Array.isArray(ref.itemIds)||ref.itemIds.some(id=>typeof id!=='string'))))throw Error('자동 분배 설정을 확인해 주세요. 기존 설정은 덮어쓰지 않습니다.');return data;}
export function distributionPriority(data,plan,settings){
 const items=lectureItems(data).filter(item=>item.planId===plan.id),current=orderedCategories(data,plan.id,items.map(item=>item.category)),saved=settings.certifications[plan.id]?.priority;
 if(saved){const result=[];for(const ref of saved){const matches=items.filter(item=>ref.itemIds.includes(item.id));const categories=matches.length?matches.map(item=>item.category):[ref.category];for(const category of categories)if(current.includes(category)&&!result.includes(category))result.push(category);}return [...result,...current.filter(category=>!result.includes(category))];}
 return current;
}
export function saveDistributionPriority(storage,data,planId,categories,mode=undefined,examPrep=undefined,countSettings=undefined){
 if(mode!==undefined&&!['sequential','parallel'].includes(mode))throw Error('분배 방식을 확인해 주세요.');
 const items=lectureItems(data).filter(item=>item.planId===planId),actual=new Set(items.map(item=>item.category));if(!planId||categories.length!==actual.size||new Set(categories).size!==categories.length||categories.some(category=>!actual.has(category)))throw Error('학습 분류 목록이 변경되었습니다. 팝업을 다시 열어 주세요.');
 const count=countSettings===undefined?undefined:validateCountSettings(countSettings);
 const prepared=examPrep===undefined?undefined:validateExamPrep(data,planId,examPrep);
 const current=loadDistributionSettings(storage),next={...current,certifications:{...current.certifications,[planId]:{...current.certifications[planId],...(mode===undefined?{}:{mode}),...(prepared===undefined?{}:{examPrep:prepared}),...(count===undefined?{}:{countBased:count}),priority:categories.map(category=>({category,itemIds:items.filter(item=>item.category===category).map(item=>item.id)}))}}};storage.setItem(DISTRIBUTION_KEY,JSON.stringify(next));return next;
}

export function distributionMode(settings,planId){return settings.certifications[planId]?.mode||'sequential';}
export function previewForDistributionMode(mode,calculate){if(!['sequential','parallel'].includes(mode))throw Error('분배 방식을 확인해 주세요.');return calculate(mode);}

export function validateExamPrep(data,planId,entries){
 if(!Array.isArray(entries)||entries.some(ref=>!ref||typeof ref.itemId!=='string'||!Number.isSafeInteger(ref.daysBefore)||ref.daysBefore<1)||new Set(entries.map(ref=>ref.itemId)).size!==entries.length)throw Error('시험 직전 항목과 날짜를 확인해 주세요.');
 const ids=new Set(lectureItems(data).filter(item=>item.planId===planId).map(item=>item.id));return entries.filter(ref=>ids.has(ref.itemId)).map(({itemId,daysBefore})=>({itemId,daysBefore}));
}
export function examPrepSettings(data,planId,settings){return validateExamPrep(data,planId,settings.certifications[planId]?.examPrep||[]);}
export function examPrepDate(examDate,daysBefore){if(!/^\d{4}-\d{2}-\d{2}$/.test(examDate||'')||!Number.isSafeInteger(daysBefore)||daysBefore<1)return null;const date=new Date(examDate+'T00:00:00');if(!Number.isFinite(date.getTime()))return null;date.setDate(date.getDate()-daysBefore);return String(date.getFullYear()).padStart(4,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
export function pruneExamPrepSettings(storage,data){const current=loadDistributionSettings(storage);let changed=false;const certifications={...current.certifications};for(const [id,setting] of Object.entries(certifications)){if(setting.examPrep===undefined)continue;const clean=examPrepSettings(data,id,current);if(clean.length!==setting.examPrep.length){certifications[id]={...setting,examPrep:clean};changed=true;}}if(changed)storage.setItem(DISTRIBUTION_KEY,JSON.stringify({...current,certifications}));}

export function saveExamPrepSettings(storage,data,planId,entries){const prepared=validateExamPrep(data,planId,entries),current=loadDistributionSettings(storage),previous=current.certifications[planId]||{priority:distributionPriority(data,{id:planId},current).map(category=>({category,itemIds:lectureItems(data).filter(item=>item.planId===planId&&item.category===category).map(item=>item.id)}))};const next={...current,certifications:{...current.certifications,[planId]:{...previous,examPrep:prepared}}};storage.setItem(DISTRIBUTION_KEY,JSON.stringify(next));return next;}

export function validateCountSettings(value){if(!value||typeof value.enabled!=='boolean'||!(value.dailyLimit==null||Number.isSafeInteger(value.dailyLimit)&&value.dailyLimit>0))throw Error('개수 기준 일일 한도는 1 이상의 정수 또는 빈칸으로 입력해 주세요.');return {enabled:value.enabled,dailyLimit:value.dailyLimit??null};}
export function distributionCountSettings(settings,planId){return validateCountSettings(settings.certifications[planId]?.countBased||{enabled:true,dailyLimit:null});}
