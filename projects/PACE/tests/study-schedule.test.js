import {importStudy} from './fixtures/synthetic-study.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {emptyStudy,setLectureCompleted,lectureItems,loadStudy} from '../src/study.js';
import {moveStudyDate} from '../src/study-schedule.js';
import {missingSummary,planningProgress,remainingWorkload} from '../src/study-planning.js';
const fixture=()=>({...emptyStudy(),catalog:[{id:'a',planId:'p',studyKind:'book',category:'교재',title:'첫 교재',date:'2026-10-10'},{id:'b',planId:'p',studyKind:'review',category:'복습',title:'복습',date:'2026-10-10'},{id:'done',planId:'p',studyKind:'book',category:'교재',title:'완료 교재'},{id:'other',planId:'q',studyKind:'mock',category:'기출'}],lectureCompletion:{done:{completed:true}},categoryColors:{p:{교재:'#abc'}}});
test('미설정 안내는 자격증별 미완료 항목 분류별·전체 개수만 센다',()=>{const data=fixture();assert.equal(missingSummary(data,'p'),'교재 1개 · 복습 1개 / 총 2개');assert.equal(missingSummary(setLectureCompleted(data,'a',true),'p'),'복습 1개 / 총 1개');});
test('수동 이동은 해당 날짜만 바꾸고 완료·ID·제목·다른 항목과 설정 보존 및 재로드 유지',()=>{
 const data=fixture(),snapshot=structuredClone(data),next=moveStudyDate(data,'p','a','2026-10-12');assert.equal(next.catalog[0].date,'2026-10-12');assert.equal(next.catalog[0].scheduleSource,'manual');assert.equal(next.catalog[0].id,'a');assert.equal(next.catalog[0].title,data.catalog[0].title);assert.deepEqual(next.catalog.slice(1),data.catalog.slice(1));assert.equal(next.lectureCompletion,data.lectureCompletion);assert.equal(next.categoryColors,data.categoryColors);assert.deepEqual(data,snapshot);assert.deepEqual(loadStudy({getItem:()=>JSON.stringify(next)}),next);assert.throws(()=>moveStudyDate(data,'q','a','2026-10-12'));assert.throws(()=>moveStudyDate(data,'p','a','2026-02-30'));
});
test('완료·취소는 공통 기록을 사용해 진행도와 남은 학습량을 함께 갱신',()=>{const data=fixture(),next=setLectureCompleted(data,'a',true);assert.equal(lectureItems(next)[0].completed,true);assert.equal(planningProgress(next,'p').completed,2);assert.equal(remainingWorkload(next,'p').missing,1);assert.equal(planningProgress(setLectureCompleted(next,'a',false),'p').completed,1);});
test('기존 날짜 공유 강의도 다른 강의 배정과 완료를 변경하지 않고 독립 이동',()=>{const data=importStudy(emptyStudy(),[{id:'p',name:'정보처리기사 실기',goals:[]}]).data,items=lectureItems(data),next=moveStudyDate(data,'p',items[0].id,'2026-10-20');assert.equal(lectureItems(next)[0].date,'2026-10-20');assert.deepEqual(lectureItems(next).slice(1),items.slice(1));assert.equal(next.completion,data.completion);});

test('미설정 개수는 학습 유형 대신 실제 사용자 분류명과 표시 순서를 따르고 완료 항목 제외',()=>{
 const data={...emptyStudy(),catalog:[{id:'a',planId:'p',category:'핵심 문제',studyKind:'mock'},{id:'b',planId:'p',category:'핵심 문제',studyKind:'past'},{id:'c',planId:'p',category:'오답 정리',studyKind:'review'},{id:'done',planId:'p',category:'오답 정리',studyKind:'review'}],categoryOrder:{p:['오답 정리','핵심 문제']},lectureCompletion:{done:{completed:true}}};assert.equal(missingSummary(data,'p'),'오답 정리 1개 · 핵심 문제 2개 / 총 3개');
});
