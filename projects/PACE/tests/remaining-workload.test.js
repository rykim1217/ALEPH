import test from 'node:test';import assert from 'node:assert/strict';
import {emptyStudy,setLectureCompleted} from '../src/study.js';
import {remainingWorkload,formatWorkload} from '../src/study-planning.js';
test('미완료만 합산하고 강의만 배속 적용하며 합산 후 올림한다',()=>{
 const data={...emptyStudy(),catalog:[{id:'a',planId:'p',studyKind:'lecture',originalSeconds:61},{id:'b',planId:'p',studyKind:'lecture',originalSeconds:61},{id:'done',planId:'p',studyKind:'mock',expectedMinutes:120},{id:'book',planId:'p',studyKind:'book',expectedMinutes:30},{id:'missing',planId:'p',studyKind:'review'},{id:'other',planId:'q',studyKind:'other',expectedMinutes:500}],lectureCompletion:{done:{completed:true}}},before=structuredClone(data);
 assert.deepEqual(remainingWorkload(data,'p',2),{minutes:32,missing:1});assert.deepEqual(remainingWorkload(data,'p',1),{minutes:33,missing:1});assert.deepEqual(data,before);
 const configured=setLectureCompleted(data,'missing',true);assert.deepEqual(remainingWorkload(configured,'p',2),{minutes:32,missing:0});const completed=setLectureCompleted(configured,'book',true);assert.equal(remainingWorkload(completed,'p',2).minutes,2);assert.equal(remainingWorkload(setLectureCompleted(completed,'book',false),'p',2).minutes,32);assert.deepEqual(remainingWorkload(emptyStudy(),'p'),{minutes:0,missing:0});
});
test('시간·분 표기',()=>{assert.equal(formatWorkload(2550),'42시간 30분');assert.equal(formatWorkload(50),'50분');assert.equal(formatWorkload(6000),'100시간');assert.equal(formatWorkload(0),'0분');});

test('미설정 항목 시간 입력 및 완료 변경에 따라 부분 합계와 누락 개수를 갱신한다',()=>{
 const data={...emptyStudy(),catalog:[{id:'x',planId:'p',studyKind:'mock'},{id:'y',planId:'p',studyKind:'book',expectedMinutes:50}]};
 assert.deepEqual(remainingWorkload(data,'p'),{minutes:50,missing:1});
 assert.deepEqual(remainingWorkload({...data,catalog:data.catalog.map(i=>i.id==='x'?{...i,expectedMinutes:10}:i)},'p'),{minutes:60,missing:0});
 const completed=setLectureCompleted(data,'x',true);assert.deepEqual(remainingWorkload(completed,'p'),{minutes:50,missing:0});assert.equal(remainingWorkload(setLectureCompleted(completed,'x',false),'p').minutes,50);
 assert.deepEqual(remainingWorkload(setLectureCompleted(completed,'y',true),'p'),{minutes:0,missing:0});
});

test('모든 미완료 시간이 없어도 0분 부분 합계를 표시하고 완료 후 누락 경고를 없앤다',()=>{
 const data={...emptyStudy(),catalog:[{id:'x',planId:'p',category:'모의고사',studyKind:'mock'}]};assert.deepEqual(remainingWorkload(data,'p'),{minutes:0,missing:1});assert.deepEqual(remainingWorkload(setLectureCompleted(data,'x',true),'p'),{minutes:0,missing:0});
});
