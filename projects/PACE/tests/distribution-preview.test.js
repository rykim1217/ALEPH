import test from 'node:test';import assert from 'node:assert/strict';
import {calculateDistribution} from '../src/distribution-preview.js';
import {planningMinutes} from '../src/study-planning.js';
import {emptyStudy,loadStudy} from '../src/study.js';import {emptyAvailability} from '../src/availability.js';import {configureMilestone} from '../src/certifications.js';
const today=new Date(2026,9,10,23,59),plan={id:'p',name:'정보처리기사 실기',examDate:'2026-10-20',goals:[]};
const item=(id,minutes=60,category='이론',extra={})=>({id,planId:'p',studyKind:'book',title:id,category,order:Number(id.replace(/[^0-9]/g,''))||1,...(minutes==null?{}:{expectedMinutes:minutes}),...extra});
const data=(catalog)=>({...emptyStudy(),catalog});
const rules=(extra={})=>({version:2,certifications:{p:{...emptyAvailability(),daily:240,startDate:'2026-10-01',endDate:null,...extra}}});
const calc=(study,options={})=>calculateDistribution({data:study,plan,availability:rules(),priority:['이론','SQL'],today,speed:1,minutesFor:planningMinutes,countSettings:{enabled:false,dailyLimit:null},...options});
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
test('매일 4시간을 오늘부터 채우고 12시간은 3일에 완료하며 균등 분배하지 않는다',()=>{
 const study=data(Array.from({length:12},(_,i)=>item('i'+(i+1))));freeze(study);const result=calc(study);assert.deepEqual(result.days.map(day=>[day.date,day.used,day.items.length]),[['2026-10-10',240,4],['2026-10-11',240,4],['2026-10-12',240,4]]);assert.equal(result.summary.expectedDate,'2026-10-12');assert.equal(result.summary.assignedMinutes,720);assert.equal(result.summary.unplaced,0);assert.equal(study.catalog[0].date,undefined);
});
test('강의만 배속 반영하고 시간 미설정과 완료 항목 제외, 수동·과거 미완료 모두 재계산',()=>{
 const study=data([item('i1',null,'이론',{studyKind:'lecture',originalSeconds:3600,date:'2026-10-05'}),item('i2',50,'이론',{date:'2026-10-18'}),item('i3',null,'기출문제',{studyKind:'past'}),item('i4',null,'모의고사',{studyKind:'mock'}),item('i5',60,'이론',{date:'2026-10-01'}),{...item('other',900),planId:'q'}]);study.lectureCompletion={i5:{completed:true}};const before=JSON.stringify(study),result=calc(study,{speed:1.5});assert.deepEqual(result.assignments.map(a=>[a.itemId,a.minutes,a.date]),[['i1',40,'2026-10-10'],['i2',50,'2026-10-10']]);assert.deepEqual(result.missingCounts,[{category:'기출문제',count:1},{category:'모의고사',count:1}]);assert.equal(JSON.stringify(study),before);assert.deepEqual(loadStudy({getItem:()=>before}),study);
});
test('항목은 분할하지 않고 같은 분류 순서를 유지하며 빈틈에 다른 분류를 배치한다',()=>{
 const study=data([item('i1',220),item('i2',40),item('i3',10),item('s1',20,'SQL')]),result=calc(study);assert.deepEqual(result.days[0].items.map(a=>a.itemId),['i1','s1']);assert.deepEqual(result.days[1].items.map(a=>a.itemId),['i2','i3']);assert.equal(result.assignments.length,4);assert.ok(result.days.every(day=>day.used<=day.capacity));
});
test('휴식일·예외·설정 기간·시험 전날을 반영하고 시간 부족 항목은 미배치로 유지',()=>{
 const study=data([item('i1',200),item('i2',80),item('i3',70),item('i4',30)]),result=calc(study,{plan:{...plan,examDate:'2026-10-14'},availability:rules({startDate:'2026-10-10',endDate:'2026-10-12',restDays:[0],exceptions:{'2026-10-12':{kind:'study',minutes:90}}})});assert.deepEqual(result.assignments.map(a=>[a.itemId,a.date]),[['i1','2026-10-10'],['i2','2026-10-12']]);assert.equal(result.unplaced.length,2);assert.equal(result.summary.unplacedMinutes,100);assert.ok(result.days.every(day=>day.used<=day.capacity));
});
test('완료된 미래 항목은 기존 날짜 유지하고 용량에서 먼저 차감한다',()=>{
 const study=data([item('done',180,'이론',{date:'2026-10-10'}),item('i1',100),item('i2',60,'SQL')]);study.lectureCompletion={done:{completed:true}};const result=calc(study);assert.equal(result.days[0].reserved,180);assert.deepEqual(result.days[0].items.map(a=>a.itemId),['i2']);assert.equal(result.assignments.find(a=>a.itemId==='i1').date,'2026-10-11');assert.equal(study.catalog[0].date,'2026-10-10');assert.equal(study.lectureCompletion.done.completed,true);
});
test('완료 항목의 시간 미설정 날짜는 용량을 임의 추정하지 않고 안내 후 건너뛴다',()=>{
 const study=data([item('done',null,'이론',{date:'2026-10-10'}),item('i1',60)]);study.lectureCompletion={done:{completed:true}};const result=calc(study);assert.equal(result.assignments[0].date,'2026-10-11');assert.equal(result.warnings[0].date,'2026-10-10');assert.match(result.warnings[0].reason,/용량을 확정/);
});
test('총 시간은 충분해도 하루에 들어가지 않는 항목은 실제 미배치로 처리',()=>{
 const study=data([item('i1',300),item('s1',60,'SQL')]),result=calc(study);assert.equal(result.unplaced.length,1);assert.equal(result.unplaced[0].itemId,'i1');assert.equal(result.assignments[0].itemId,'s1');assert.match(result.unplaced[0].reason,/분할 없이/);
});
test('이정표는 목표일을 포함해 판단하고 늦으면 실제 예상 완료일과 지연 일수를 표시',()=>{
 const study=data([item('i1',240),item('i2',240),item('i3',240)]),goal=configureMilestone({id:'g',title:'1회독 완료',date:'2026-10-11'},study,'p',true,['이론']),result=calc(study,{plan:{...plan,goals:[goal]}});assert.equal(result.milestones[0].status,'late');assert.equal(result.milestones[0].onTime,2);assert.equal(result.milestones[0].remaining,1);assert.equal(result.milestones[0].expectedDate,'2026-10-12');assert.equal(result.milestones[0].delayDays,1);assert.equal(goal.date,'2026-10-11');assert.equal(calc(study,{plan:{...plan,goals:[{...goal,date:'2026-10-12'}]}}).milestones[0].status,'met');
});
test('다중 이정표와 시간 미설정·시험 전 완료 불가능 상태를 구분한다',()=>{
 const study=data([item('i1',240),item('i2',240),item('i3',null,'SQL')]),g1=configureMilestone({id:'g1',title:'빠른 목표',date:'2026-10-10'},study,'p',true,['이론']),g2=configureMilestone({id:'g2',title:'다음 목표',date:'2026-10-12'},study,'p',true,['이론','SQL']);const result=calc(study,{plan:{...plan,goals:[g1,g2]}});assert.equal(result.milestones[0].status,'late');assert.equal(result.milestones[1].status,'unknown');assert.deepEqual(result.milestones[0].overlap,['이론']);const impossible=calc(study,{plan:{...plan,examDate:'2026-10-11',goals:[g1]}});assert.equal(impossible.milestones[0].status,'impossible');assert.equal(impossible.milestones[0].expectedDate,null);
});
test('우선순위 저장 순서와 분류별 등록 순서를 사용하고 이정표는 빠른 목표일을 우선 고려',()=>{
 const study=data([item('i2',240),item('i1',240),item('s1',240,'SQL')]);const normal=calc(study,{priority:['SQL','이론']});assert.deepEqual(normal.assignments.map(a=>a.itemId),['s1','i1','i2']);const goal=configureMilestone({id:'g',title:'이론 우선',date:'2026-10-10'},study,'p',true,['이론']);const withGoal=calc(study,{priority:['SQL','이론'],plan:{...plan,goals:[goal]}});assert.equal(withGoal.assignments[0].itemId,'i1');
});
test('시험일 오늘·과거·시간 미설정·시험일 없음 및 기존 완료 용량 초과를 안전하게 처리',()=>{
 const study=data([item('i1',60)]);assert.equal(calc(study,{plan:{...plan,examDate:'2026-10-10'}}).unplaced.length,1);assert.throws(()=>calc(study,{plan:{...plan,examDate:null}}));assert.equal(calc(study,{availability:rules({daily:null})}).assignments.length,0);const over=data([item('done',300,'이론',{date:'2026-10-10'}),item('i1',60)]);over.lectureCompletion={done:{completed:true}};const result=calc(over);assert.match(result.warnings[0].reason,/초과/);assert.equal(result.assignments[0].date,'2026-10-11');
});

test('계산과 미리보기 결과 변경은 원본 일정·이정표·시간·완료와 저장 복원 결과를 바꾸지 않는다',()=>{
 const study=data([item('i1',120,'이론',{date:'2026-09-01'}),item('i2',120,'이론',{date:'2026-10-19'})]),goal=configureMilestone({id:'g',title:'기존 목표',date:'2026-10-11'},study,'p',true,['이론']),target={...plan,goals:[goal]},availability=rules();const original=JSON.stringify(study),originalPlan=JSON.stringify(target),originalRules=JSON.stringify(availability);freeze(study);freeze(target);freeze(availability);const result=calc(study,{plan:target,availability});result.assignments[0].date='2026-12-01';assert.equal(JSON.stringify(study),original);assert.equal(JSON.stringify(target),originalPlan);assert.equal(JSON.stringify(availability),originalRules);assert.deepEqual(loadStudy({getItem:()=>original}),study);
});
test('초 단위 강의 시간도 하루 용량을 초과하지 않고 로컬 날짜를 유지',()=>{
 const study=data(Array.from({length:9},(_,i)=>item('i'+i,null,'이론',{studyKind:'lecture',originalSeconds:2400}))),result=calc(study,{speed:1.5});assert.ok(result.days.every(day=>day.used<=day.capacity));assert.equal(result.startDate,'2026-10-10');assert.equal(result.assignments[0].date,'2026-10-10');
});
