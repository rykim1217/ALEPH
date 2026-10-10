import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStudy,lectureItems} from '../src/study.js';
import {distributionStudySnapshot,applyDistributionPreview} from '../src/study-schedule.js';
import {calculateDistribution} from '../src/distribution-preview.js';
import {planningMinutes} from '../src/study-planning.js';
import {emptyAvailability} from '../src/availability.js';
const fixture=()=>({...emptyStudy(),catalog:[{id:'a',planId:'p',category:'A',studyKind:'book',title:'a',expectedMinutes:60,date:'2026-10-18'},{id:'b',planId:'p',category:'B',studyKind:'book',title:'b'},{id:'done',planId:'p',category:'A',studyKind:'book',title:'done',date:'2026-10-09'},{id:'other',planId:'q',category:'A',title:'other',date:'2026-10-11'}],lectureCompletion:{done:{completed:true,updatedAt:'preserved'}},itemOverrides:{a:{title:'custom'}}});
for(const mode of ['sequential','parallel'])test(mode+': time and count preview applied exactly without input writes',()=>{
 const data=fixture(),before=JSON.stringify(data),result=calculateDistribution({data,plan:{id:'p',examDate:'2026-10-20',goals:[]},availability:{version:2,certifications:{p:{...emptyAvailability(),daily:240,startDate:'2026-10-01',endDate:null}}},priority:['A','B'],today:new Date(2026,9,10),speed:1,minutesFor:planningMinutes,mode,countSettings:{enabled:true,dailyLimit:null}});
 assert.equal(JSON.stringify(data),before);assert.equal(result.assignments.length,2);
 const next=applyDistributionPreview(data,result,distributionStudySnapshot(data,'p')),items=lectureItems(next);
 for(const assignment of result.assignments)assert.equal(items.find(item=>item.id===assignment.itemId).date,assignment.date);
 assert.deepEqual(next.catalog,data.catalog);assert.deepEqual(next.lectureCompletion,data.lectureCompletion);assert.equal(next.itemOverrides.a.title,'custom');assert.equal(items.find(item=>item.id==='done').date,'2026-10-09');assert.equal(items.find(item=>item.id==='other').date,'2026-10-11');assert.equal(JSON.stringify(data),before);
 assert.deepEqual(applyDistributionPreview(next,result,distributionStudySnapshot(next,'p')),next);
 assert.deepEqual(lectureItems(JSON.parse(JSON.stringify(next))),items);
});
test('unplaced schedules stay intact and stale preview is rejected atomically',()=>{
 const data=fixture(),snapshot=distributionStudySnapshot(data,'p'),result={planId:'p',assignments:[{itemId:'b',date:'2026-10-12'}]};
 const next=applyDistributionPreview(data,result,snapshot);assert.equal(lectureItems(next).find(item=>item.id==='a').date,'2026-10-18');
 const changed={...data,lectureCompletion:{...data.lectureCompletion,b:{completed:true}}};assert.throws(()=>applyDistributionPreview(changed,result,snapshot),/다시 계산/);
 for(const assignments of [[{itemId:'done',date:'2026-10-12'}],[{itemId:'other',date:'2026-10-12'}],[{itemId:'b',date:'invalid'}],[{itemId:'b',date:'2026-10-12'},{itemId:'b',date:'2026-10-13'}]])assert.throws(()=>applyDistributionPreview(data,{planId:'p',assignments},snapshot));
});
