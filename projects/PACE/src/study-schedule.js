import {lectureItems} from './study.js';
import {validDate} from './availability.js';
export function moveStudyDate(data,planId,id,date){
 const item=lectureItems(data).find(i=>i.id===id);
 if(!item||item.planId!==planId||!validDate(date))throw Error('학습 항목과 이동할 날짜를 확인해 주세요.');
 if(data.catalog?.some(i=>i.id===id))return {...data,catalog:data.catalog.map(i=>i.id===id?{...i,date,scheduleSource:'manual'}:i)};
 return {...data,itemOverrides:{...data.itemOverrides,[id]:{...data.itemOverrides?.[id],date,scheduleSource:'manual'}}};
}

// Apply only the displayed assignments; never regenerate items or completion history.
export function distributionStudySnapshot(data,planId){return JSON.stringify(lectureItems(data).filter(item=>item.planId===planId));}
export function applyDistributionPreview(data,result,snapshot){
 if(!result?.planId||!Array.isArray(result.assignments)||snapshot!==distributionStudySnapshot(data,result.planId))throw Error('학습 데이터가 변경되었습니다. 미리보기를 다시 계산해 주세요.');
 const items=new Map(lectureItems(data).map(item=>[item.id,item])),seen=new Set();
 for(const assignment of result.assignments){const item=items.get(assignment.itemId);if(!item||item.planId!==result.planId||item.completed||seen.has(item.id)||!validDate(assignment.date))throw Error('분배 결과를 다시 확인해 주세요.');seen.add(item.id);}
 const overrides={...data.itemOverrides};
 for(const assignment of result.assignments)overrides[assignment.itemId]={...overrides[assignment.itemId],date:assignment.date,scheduleSource:'automatic'};
 return {...data,itemOverrides:overrides};
}
