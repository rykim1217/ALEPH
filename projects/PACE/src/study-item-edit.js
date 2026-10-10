import {lectureItems,validExpectedMinutes} from './study.js';
import {orderedCategories} from './category-order.js';

export function updateStudyCategory(data,planId,category,{name,expectedMinutes=undefined,color}){
 const names={theory:'이론',programming:'프로그래밍',sql:'SQL'},title=String(name||'').trim();
 const items=lectureItems(data).filter(i=>i.planId===planId),members=items.filter(i=>i.category===category);
 if(!members.length)throw new Error('수정할 학습 분류가 없습니다.');
 if(!title||title.length>60)throw new Error('분류명은 1~60자로 입력해 주세요.');
 if(items.some(i=>i.category!==category&&(names[i.category]||i.category).trim()===title))throw new Error('같은 이름의 학습 분류가 이미 있습니다.');
 if(!validExpectedMinutes(expectedMinutes))throw new Error('예상 시간은 0보다 큰 분 단위 숫자로 입력해 주세요.');
 if(expectedMinutes!==undefined&&members.some(i=>!canBatchEditTime(i)))throw new Error('강의 분류는 예상 시간을 일괄 수정할 수 없습니다.');
 const nextCategory=title===(names[category]||category)?category:title;
 const ids=new Set(members.map(i=>i.id)),patch={category:nextCategory,...(expectedMinutes!==undefined?{expectedMinutes}:{})};
 const catalog=(data.catalog||[]).map(i=>ids.has(i.id)?{...i,...patch}:i),itemOverrides={...data.itemOverrides};
 for(const item of members)if(!data.catalog?.some(i=>i.id===item.id))itemOverrides[item.id]={...itemOverrides[item.id],...patch};
 const colors={...data.categoryColors?.[planId]};if(nextCategory!==category){const current=colors[category]??color;if(current!=null)colors[nextCategory]=current;delete colors[category];}
 const order=orderedCategories(data,planId,items.map(i=>i.category)).map(key=>key===category?nextCategory:key);
 return {...data,catalog,itemOverrides,categoryColors:{...data.categoryColors,[planId]:colors},categoryOrder:{...data.categoryOrder,[planId]:order}};
}

export const canBatchEditTime=item=>['book','past','mock','review','other'].includes(item.studyKind);
export function updateSelectedTimes(data,planId,ids,minutes){
 if(minutes==null||!validExpectedMinutes(minutes))throw new Error('0보다 큰 예상 시간을 분 단위로 입력해 주세요.');
 const selected=new Set(ids),items=lectureItems(data),targets=items.filter(i=>selected.has(i.id));
 if(!selected.size||targets.length!==selected.size||targets.some(i=>i.planId!==planId))throw new Error('수정할 항목과 자격증을 다시 확인해 주세요.');
 const editable=new Set(targets.filter(canBatchEditTime).map(i=>i.id));
 if(!editable.size)throw new Error('예상 시간을 수정할 수 있는 항목이 없습니다.');
 return {...data,catalog:(data.catalog||[]).map(item=>editable.has(item.id)?{...item,expectedMinutes:minutes}:item)};
}

export function updateStudyItem(data,id,changes){
 const item=lectureItems(data).find(i=>i.id===id);
 if(!item)throw new Error('학습 항목을 찾을 수 없습니다.');
 const title=String(changes.title??item.title).trim(),category=String(changes.category??item.category).trim();
 const number=String(changes.number??item.number??'').trim();
 if(!title||!category)throw new Error('항목명과 학습 분류를 입력해 주세요.');
 if(item.number&&!number)throw new Error('번호를 입력해 주세요.');
 if(number&&!/^\d+(?:\.\d+)*$/.test(number))throw new Error('번호를 확인해 주세요.');
 const originalSeconds=Object.hasOwn(changes,'originalSeconds')?changes.originalSeconds:item.originalSeconds;
 if((item.originalSeconds!=null||Object.hasOwn(changes,'originalSeconds'))&&(!Number.isInteger(originalSeconds)||originalSeconds<=0))throw new Error('강의 시간을 확인해 주세요.');
 const expectedMinutes=Object.hasOwn(changes,'expectedMinutes')?changes.expectedMinutes:item.expectedMinutes;
 if(!validExpectedMinutes(expectedMinutes))throw new Error('예상 시간은 0보다 큰 분 단위 숫자로 입력해 주세요.');
 const patch={title,category,...(Object.hasOwn(changes,'expectedMinutes')?{expectedMinutes}:{}),...(number?{number}:{}),...(originalSeconds!=null?{originalSeconds}:{})};
 if(data.catalog?.some(i=>i.id===id))return {...data,catalog:data.catalog.map(i=>i.id===id?{...i,...patch}:i)};
 return {...data,itemOverrides:{...data.itemOverrides,[id]:{...data.itemOverrides?.[id],...patch}}};
}

export function deleteStudyItems(data,planId,ids){
 const selected=new Set(ids),all=lectureItems(data),targets=all.filter(i=>selected.has(i.id));
 if(!selected.size||targets.length!==selected.size||targets.some(i=>i.planId!==planId))throw new Error('삭제 대상 자격증과 항목을 다시 확인해 주세요.');
 const deleted=new Set([...(data.deletedItemIds||[]),...targets.filter(i=>!data.catalog?.some(c=>c.id===i.id)).map(i=>i.id)]);
 const catalog=(data.catalog||[]).filter(i=>!selected.has(i.id));
 const remaining=all.filter(i=>!selected.has(i.id));
 const emptyRecords=new Set(targets.filter(i=>data.records.some(r=>r.id===i.recordId)&&!remaining.some(other=>other.recordId===i.recordId)).map(i=>i.recordId));
 const clean=map=>Object.fromEntries(Object.entries(map||{}).filter(([id])=>!selected.has(id)&&!emptyRecords.has(id)));
 return {...data,catalog,records:data.records.filter(r=>!emptyRecords.has(r.id)),completion:clean(data.completion),lectureCompletion:clean(data.lectureCompletion),itemOverrides:clean(data.itemOverrides),deletedItemIds:[...deleted]};
}

export function categoryTimeValue(members){const values=[...new Set(members.map(item=>Number.isFinite(item.expectedMinutes)&&item.expectedMinutes>0?item.expectedMinutes:null))];return {mixed:values.length>1,value:values.length===1?values[0]:null};}
