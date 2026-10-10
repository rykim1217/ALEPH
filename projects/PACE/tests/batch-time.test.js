import test from 'node:test';import assert from 'node:assert/strict';
import {emptyStudy,loadStudy} from '../src/study.js';
import {updateSelectedTimes,canBatchEditTime} from '../src/study-item-edit.js';
const fixture=()=>({...emptyStudy(),catalog:[{id:'lecture',planId:'p',studyKind:'lecture',originalSeconds:1945},{id:'a',planId:'p',studyKind:'mock',expectedMinutes:120,date:'2026-10-10'},{id:'b',planId:'p',studyKind:'book'},{id:'c',planId:'q',studyKind:'review'}],lectureCompletion:{a:{completed:true}},categoryOrder:{p:['모의고사']},categoryColors:{p:{모의고사:'#abc'}}});
test('複数 선택 시간만 변경하고 강의 원본·완료·날짜·색상·분류 순서를 보존',()=>{
 const data=fixture(),next=updateSelectedTimes(data,'p',['lecture','a','b'],60);
 assert.equal(next.catalog[0],data.catalog[0]);assert.equal(next.catalog[0].originalSeconds,1945);assert.equal(next.catalog[1].expectedMinutes,60);assert.equal(next.catalog[2].expectedMinutes,60);assert.equal(next.catalog[1].date,'2026-10-10');assert.equal(next.catalog[3],data.catalog[3]);assert.equal(next.lectureCompletion,data.lectureCompletion);assert.equal(next.categoryColors,data.categoryColors);assert.equal(next.categoryOrder,data.categoryOrder);assert.equal(data.catalog[1].expectedMinutes,120);assert.deepEqual(loadStudy({getItem:()=>JSON.stringify(next)}),next);
});
test('일부 선택·적용 유형 및 잘못된 입력과 다른 자격증 선택을 검증',()=>{
 const data=fixture(),next=updateSelectedTimes(data,'p',['a'],45);assert.equal(next.catalog[2],data.catalog[2]);
 for(const studyKind of ['book','past','mock','review','other'])assert.ok(canBatchEditTime({studyKind}));assert.equal(canBatchEditTime({studyKind:'lecture'}),false);assert.equal(canBatchEditTime({}),false);
 for(const minutes of [null,0,-1,NaN,Infinity,'60'])assert.throws(()=>updateSelectedTimes(data,'p',['a'],minutes));
 assert.throws(()=>updateSelectedTimes(data,'p',['lecture'],60));assert.throws(()=>updateSelectedTimes(data,'p',['a','c'],60));assert.throws(()=>updateSelectedTimes(data,'p',[],60));assert.throws(()=>updateSelectedTimes(data,'p',['missing'],60));
});
