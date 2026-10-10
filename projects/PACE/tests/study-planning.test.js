import test from 'node:test';import assert from 'node:assert/strict';
import {PLANNING_KEY,loadPlanning,setPlanningSpeed,planningMinutes,planningProgress,weekDates} from '../src/study-planning.js';
import {emptyStudy} from '../src/study.js';import {dateKey} from '../src/calendar.js';
test('계획 배속은 기본 1배, 자격증별 독립 저장, 손상 데이터 덮어쓰기 없음',()=>{
 const initial=loadPlanning({getItem:()=>null});assert.equal(initial.certifications.p,undefined);const next=setPlanningSpeed(setPlanningSpeed(initial,'p',1.5),'q',2);assert.equal(next.certifications.p.speed,1.5);assert.equal(next.certifications.q.speed,2);assert.deepEqual(initial,{version:1,certifications:{}});assert.deepEqual(loadPlanning({getItem:key=>key===PLANNING_KEY?JSON.stringify(next):null}),next);assert.throws(()=>setPlanningSpeed(next,'p',3));assert.throws(()=>loadPlanning({getItem:()=>'{broken'}));
});
test('강의만 배속 적용하고 선택 시간과 미입력 및 원본 데이터 보존',()=>{
 const lecture={studyKind:'lecture',originalSeconds:3600};assert.equal(planningMinutes(lecture,1.5),40);assert.equal(lecture.originalSeconds,3600);for(const studyKind of ['book','past','mock','review','other'])assert.equal(planningMinutes({studyKind,expectedMinutes:120},2),120);assert.equal(planningMinutes({studyKind:'book'},2),null);assert.equal(planningMinutes({studyKind:'lecture'},2),null);
});
test('진행도는 실제 완료 기록으로만 계산하며 다른 자격증과 관리 선택을 제외',()=>{
 const data={...emptyStudy(),catalog:[{id:'a',planId:'p',category:'이론',studyKind:'lecture'},{id:'b',planId:'p',category:'이론',studyKind:'lecture'},{id:'c',planId:'p',category:'모의고사',studyKind:'mock'},{id:'d',planId:'q',category:'기타',studyKind:'other'}],lectureCompletion:{a:{completed:true},d:{completed:true}},selection:['b','c']};const snapshot=structuredClone(data),p=planningProgress(data,'p');assert.equal(p.total,3);assert.equal(p.completed,1);assert.equal(p.remaining,2);assert.equal(p.percent,33);assert.deepEqual(p.categories,[{category:'이론',total:2,completed:1},{category:'모의고사',total:1,completed:0}]);assert.equal(planningProgress(emptyStudy(),'p').percent,0);assert.deepEqual(data,snapshot);
});
test('주간 화면은 연도 경계에서도 실제 날짜 7일만 생성',()=>{assert.deepEqual(weekDates(new Date(2026,0,1)).map(dateKey),['2025-12-28','2025-12-29','2025-12-30','2025-12-31','2026-01-01','2026-01-02','2026-01-03']);});

import {remainingAvailability} from '../src/study-planning.js';
import {emptyAvailability} from '../src/availability.js';
test('남은 가능 시간은 오늘 포함·시험일 제외, 휴식·예외·자격증별 기간을 반영하고 설정을 보존',()=>{
 const data={version:2,certifications:{p:{...emptyAvailability(),startDate:'2026-10-01',endDate:null,mode:'split',weekday:60,weekend:120,restDays:[0],exceptions:{'2026-10-11':{kind:'study',minutes:30},'2026-10-12':{kind:'rest',minutes:0}}},q:{...emptyAvailability(),startDate:'2026-10-01',daily:10}}};const snapshot=structuredClone(data);
 assert.equal(remainingAvailability(data,'p','2026-10-14',new Date(2026,9,10)),210);
 assert.equal(remainingAvailability(data,'q','2026-10-14',new Date(2026,9,10)),40);
 data.certifications.p.endDate='2026-10-11';assert.equal(remainingAvailability(data,'p','2026-10-14',new Date(2026,9,10)),150);data.certifications.p.endDate=null;assert.deepEqual(data,snapshot);
});
test('시험일이 오늘·과거면 0분, 시험일 및 시간 미설정은 합계를 만들어 넣지 않는다',()=>{
 const data={version:2,certifications:{p:{...emptyAvailability(),startDate:'2026-10-10'}}};const today=new Date(2026,9,10);
 assert.equal(remainingAvailability(data,'p','2026-10-10',today),0);assert.equal(remainingAvailability(data,'p','2026-10-09',today),0);assert.equal(remainingAvailability(data,'p',null,today),null);assert.equal(remainingAvailability(data,'p','2026-10-12',today),null);assert.equal(remainingAvailability(data,'q','2026-10-12',today),null);
});
test('설정 시작일까지는 제외하며 명시적인 0분은 유효한 합계로 계산',()=>{
 const data={version:2,certifications:{p:{...emptyAvailability(),startDate:'2026-10-12',daily:60},q:{...emptyAvailability(),startDate:'2026-10-10',daily:0}}};
 assert.equal(remainingAvailability(data,'p','2026-10-14',new Date(2026,9,10)),120);assert.equal(remainingAvailability(data,'q','2026-10-14',new Date(2026,9,10)),0);
});
