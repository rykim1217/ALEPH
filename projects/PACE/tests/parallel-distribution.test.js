import test from 'node:test';import assert from 'node:assert/strict';
import {calculateDistribution} from '../src/distribution-preview.js';import {planningMinutes} from '../src/study-planning.js';import {emptyStudy} from '../src/study.js';import {emptyAvailability} from '../src/availability.js';import {configureMilestone} from '../src/certifications.js';
const today=new Date(2026,9,10),plan={id:'p',examDate:'2026-10-30',goals:[]};
const item=(category,index,minutes=30)=>({id:category+index,planId:'p',category,order:index,title:category+index,studyKind:'book',expectedMinutes:minutes,date:'2026-10-25'});
const study=catalog=>({...emptyStudy(),catalog});const availability=(extra={})=>({version:2,certifications:{p:{...emptyAvailability(),daily:240,startDate:'2026-10-01',endDate:null,...extra}}});
const calc=(data,extra={})=>calculateDistribution({data,plan,availability:availability(),priority:['A','B','C','D'],today,speed:1,minutesFor:planningMinutes,mode:'parallel',countSettings:{enabled:false,dailyLimit:null},...extra});
function dayCategories(result,data,day){const ids=new Map(data.catalog.map(item=>[item.id,item.category]));return [...new Set(day.items.map(item=>ids.get(item.itemId)))];}
test('병행은 우선순위의 두 분류부터 시작하고 완료 후 다음 분류로 교체하며 하루 최대 두 분류',()=>{
 const data=study([...Array.from({length:2},(_,i)=>item('A',i+1)),...Array.from({length:12},(_,i)=>item('B',i+1)),...Array.from({length:8},(_,i)=>item('C',i+1)),item('D',1)]);const result=calc(data);assert.deepEqual(new Set(dayCategories(result,data,result.days[0])),new Set(['A','B']));assert.ok(result.days.slice(1).some(day=>dayCategories(result,data,day).includes('C')));assert.ok(result.days.every(day=>dayCategories(result,data,day).length<=2));assert.equal(result.assignments.length,data.catalog.length);for(const category of ['A','B','C'])assert.deepEqual(result.assignments.filter(entry=>entry.itemId.startsWith(category)).map(entry=>entry.itemId),data.catalog.filter(item=>item.category===category).map(item=>item.id));assert.equal(new Set(result.assignments.map(item=>item.itemId)).size,result.assignments.length);
});
test('남은 학습량이 많은 분류에 더 많은 시간을 주면서 두 분류를 함께 진행',()=>{
 const data=study([...Array.from({length:24},(_,i)=>item('A',i+1)),...Array.from({length:8},(_,i)=>item('B',i+1))]);const result=calc(data),first=result.days[0];const time=category=>first.items.filter(entry=>entry.itemId.startsWith(category)).reduce((sum,entry)=>sum+entry.minutes,0);assert.ok(time('A')>time('B'));assert.ok(time('B')>0);assert.ok(first.used<=first.capacity);assert.ok(result.days.every(day=>day.used<=day.capacity));
});
test('동일 학습량일 때 임박한 이정표 분류에 더 많은 시간을 배분하며 최대 두 분류 유지',()=>{
 const data=study([...Array.from({length:10},(_,i)=>item('A',i+1)),...Array.from({length:10},(_,i)=>item('B',i+1))]);const goal=configureMilestone({id:'g',title:'B 목표',date:'2026-10-11'},data,'p',true,['B']),result=calc(data,{plan:{...plan,goals:[goal]}});const first=result.days[0],time=category=>first.items.filter(entry=>entry.itemId.startsWith(category)).reduce((sum,entry)=>sum+entry.minutes,0);assert.ok(time('B')>time('A'));assert.equal(result.milestones[0].status,'met');assert.ok(result.days.every(day=>dayCategories(result,data,day).length<=2));assert.equal(goal.date,'2026-10-11');
});
test('휴식·예외 시간과 강의 배속을 적용하고 미설정 항목은 따로 제외',()=>{
 const data=study([item('A',1),item('B',1),item('C',1)]);data.catalog[0]={...data.catalog[0],studyKind:'lecture',originalSeconds:3600};delete data.catalog[0].expectedMinutes;delete data.catalog[2].expectedMinutes;const result=calc(data,{speed:2,availability:availability({restDays:[6],exceptions:{'2026-10-11':{kind:'study',minutes:60}}})});assert.equal(result.assignments[0].date,'2026-10-11');assert.equal(result.assignments.find(item=>item.itemId==='A1').minutes,30);assert.equal(result.missing[0].itemId,'C1');assert.equal(result.days[0].used,60);
});
test('긴 항목을 쪼개지 않고 들어갈 항목이 없으면 남는 시간을 비우며 순서 유지',()=>{
 const data=study([item('A',1,180),item('A',2,90),item('B',1,180),item('B',2,90)]),result=calc(data);assert.equal(result.days[0].used,180);assert.equal(result.days[0].items.length,1);assert.ok(result.days.every(day=>day.used<=240));assert.deepEqual(result.assignments.filter(item=>item.itemId.startsWith('A')).map(item=>item.itemId),['A1','A2']);
});
test('완료된 미래 항목의 용량과 분류도 제한에 반영하고 원본 일정·기록 유지',()=>{
 const data=study([item('A',1),item('B',1),item('C',1)]);data.catalog.push({...item('fixed',1,60),date:'2026-10-10'});data.lectureCompletion={fixed1:{completed:true}};const snapshot=JSON.stringify(data),result=calc(data);assert.ok(dayCategories(result,data,result.days[0]).length<=1);assert.equal(result.days[0].reserved,60);assert.equal(JSON.stringify(data),snapshot);assert.equal(result.assignments.some(item=>item.itemId==='fixed1'),false);
});
test('시간 부족·미설정·불가능한 이정표를 구분하며 기존 순차 결과는 그대로 유지',()=>{
 const data=study([...Array.from({length:5},(_,i)=>item('A',i+1,180)),item('B',1,180),item('C',1)]);delete data.catalog.at(-1).expectedMinutes;const goal=configureMilestone({id:'g',title:'A 목표',date:'2026-10-10'},data,'p',true,['A']),result=calc(data,{plan:{...plan,examDate:'2026-10-12',goals:[goal]}});assert.ok(result.unplaced.length>0);assert.equal(result.missing.length,1);assert.equal(result.milestones[0].status,'impossible');const defaultResult=calculateDistribution({data,plan,availability:availability(),priority:['A','B','C'],today,speed:1,minutesFor:planningMinutes,countSettings:{enabled:false,dailyLimit:null}});const sequential=calc(data,{mode:'sequential',priority:['A','B','C']});assert.deepEqual(sequential,defaultResult);
});
test('시간이 없는 상위 분류만 건너뛰고 실제 사용자 데이터는 수정하지 않는다',()=>{
 const data=study([item('A',1),item('B',1),item('C',1)]);delete data.catalog[0].expectedMinutes;Object.freeze(data);Object.freeze(data.catalog);data.catalog.forEach(Object.freeze);const result=calc(data);assert.deepEqual(new Set(dayCategories(result,data,result.days[0])),new Set(['B','C']));assert.equal(result.missing[0].itemId,'A1');
});
