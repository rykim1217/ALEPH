import {lectureItems} from './study.js';
import {validDate} from './availability.js';

// Trim only explicitly targeted days. Completed and unmeasured work keeps its date.
export function trimScheduleToCapacity(data,{capacityFor,minutesFor}){
 const groups=new Map();
 for(const item of lectureItems(data)){
  if(!item.date)continue;
  const key=JSON.stringify([item.planId,item.date]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(item);
 }
 const removed=[];
 for(const items of groups.values()){
  const {planId,date}=items[0],capacity=capacityFor(planId,date);
  if(!Number.isFinite(capacity)||capacity<0)continue;
  let remaining=capacity-items.filter(item=>item.completed).reduce((sum,item)=>sum+(minutesFor(item)??0),0);
  for(const item of items){
   if(item.completed)continue;
   const minutes=minutesFor(item);
   if(!Number.isFinite(minutes))continue;
   if(minutes<=remaining+1e-8)remaining-=minutes;
   else removed.push(item.id);
  }
 }
 if(!removed.length)return {data,removed};
 const itemOverrides={...data.itemOverrides};
 for(const id of removed)itemOverrides[id]={...itemOverrides[id],date:null};
 return {data:{...data,itemOverrides},removed};
}
export function moveStudyDate(data,planId,id,date){
 const item=lectureItems(data).find(i=>i.id===id);
 if(!item||item.planId!==planId||!validDate(date))throw Error('학습 항목과 이동할 날짜를 확인해 주세요.');
 if(data.catalog?.some(i=>i.id===id))return {...data,catalog:data.catalog.map(i=>i.id===id?{...i,date,scheduleSource:'manual'}:i),...(data.itemOverrides?.[id]?{itemOverrides:{...data.itemOverrides,[id]:{...data.itemOverrides[id],date,scheduleSource:'manual'}}}:{})};
 return {...data,itemOverrides:{...data.itemOverrides,[id]:{...data.itemOverrides?.[id],date,scheduleSource:'manual'}}};
}

// Apply the preview, including unscheduling its unplaced work. Preserve completion history.
export function distributionStudySnapshot(data,planId){return JSON.stringify(lectureItems(data).filter(item=>item.planId===planId));}
export function applyDistributionPreview(data,result,snapshot){
 if(!result?.planId||!Array.isArray(result.assignments)||snapshot!==distributionStudySnapshot(data,result.planId))throw Error('학습 데이터가 변경되었습니다. 미리보기를 다시 계산해 주세요.');
 const items=new Map(lectureItems(data).map(item=>[item.id,item])),seen=new Set();
 for(const assignment of result.assignments){const item=items.get(assignment.itemId);if(!item||item.planId!==result.planId||item.completed||seen.has(item.id)||!validDate(assignment.date))throw Error('분배 결과를 다시 확인해 주세요.');seen.add(item.id);}
 const unplaced=[...(result.unplaced||[]),...(result.missing||[])];
 for(const entry of unplaced){const item=items.get(entry.itemId);if(!item||item.planId!==result.planId||item.completed||seen.has(item.id))throw Error('분배 결과를 다시 확인해 주세요.');seen.add(item.id);}
 const overrides={...data.itemOverrides};
 for(const assignment of result.assignments)overrides[assignment.itemId]={...overrides[assignment.itemId],date:assignment.date,scheduleSource:'automatic'};
 for(const entry of unplaced)overrides[entry.itemId]={...overrides[entry.itemId],date:null,scheduleSource:'automatic'};
 return {...data,itemOverrides:overrides};
}

// Only an internal drag for the currently displayed certification can move an item.
export function moveDraggedStudyDate(data,reference,date,activePlanId){
 const item=reference&&lectureItems(data).find(i=>i.id===reference.itemId&&i.planId===reference.planId);
 if(!item||reference.planId!==activePlanId||item.date!==reference.date)throw Error('학습 일정이 변경되었습니다. 다시 끌어 이동해 주세요.');
 if(date===item.date)return data;
 return moveStudyDate(data,activePlanId,item.id,date);
}
