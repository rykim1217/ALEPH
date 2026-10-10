import {importStudy} from './fixtures/synthetic-study.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {emptyStudy,lectureItems} from '../src/study.js';import {updateStudyCategory,categoryTimeValue} from '../src/study-item-edit.js';
const fixture=()=>({...emptyStudy(),catalog:[{id:'a',planId:'p',category:'특강',studyKind:'mock',expectedMinutes:120,date:'2026-10-10'},{id:'b',planId:'p',category:'특강',studyKind:'mock',expectedMinutes:150},{id:'c',planId:'p',category:'교재',studyKind:'book'},{id:'d',planId:'q',category:'특강',studyKind:'mock'}],categoryColors:{p:{특강:'#abcdef',교재:'#123456'}},categoryOrder:{p:['교재','특강']},lectureCompletion:{a:{completed:true}}});
test('분류명과 시간 동시 수정은 ID·날짜·완료·색상·순서와 다른 분류를 보존',()=>{
 const data=fixture(),next=updateStudyCategory(data,'p','특강',{name:'핵심 특강',expectedMinutes:60});assert.deepEqual(next.catalog.slice(0,2).map(i=>[i.id,i.category,i.expectedMinutes]),[['a','핵심 특강',60],['b','핵심 특강',60]]);assert.equal(next.catalog[0].date,data.catalog[0].date);assert.equal(next.lectureCompletion,data.lectureCompletion);assert.equal(next.catalog[2],data.catalog[2]);assert.equal(next.catalog[3],data.catalog[3]);assert.equal(next.categoryColors.p['핵심 특강'],'#abcdef');assert.deepEqual(next.categoryOrder.p,['교재','핵심 특강']);assert.equal(data.catalog[0].category,'특강');
});
test('이름만 수정은 개별 시간 유지, 시간만 수정은 이름 유지, 잘못된 이름·시간 거부',()=>{
 const data=fixture();assert.deepEqual(updateStudyCategory(data,'p','특강',{name:'핵심'}).catalog.slice(0,2).map(i=>i.expectedMinutes),[120,150]);assert.equal(updateStudyCategory(data,'p','특강',{name:'특강',expectedMinutes:60}).catalog[0].category,'특강');
 for(const name of [' ','교재'])assert.throws(()=>updateStudyCategory(data,'p','특강',{name}));assert.throws(()=>updateStudyCategory(data,'p','특강',{name:'특강',expectedMinutes:0}));
});
test('기존 강의 분류 변경은 완료와 배정 유지, 기본색 연결 유지, 시간 수정 거부',()=>{
 const data=importStudy(emptyStudy(),[{id:'p',name:'정보처리기사 실기',goals:[]}]).data,next=updateStudyCategory(data,'p','theory',{name:'기본 이론',color:'#abc'});const before=lectureItems(data),after=lectureItems(next);assert.equal(after.length,108);assert.deepEqual(after.map(i=>[i.id,i.date,i.completed]),before.map(i=>[i.id,i.date,i.completed]));assert.equal(after[0].category,'기본 이론');assert.equal(next.categoryColors.p['기본 이론'],'#abc');assert.throws(()=>updateStudyCategory(data,'p','theory',{name:'이론',expectedMinutes:60}));
});

test('공통 시간 미리 채움과 혼합 시간 빈 입력 상태를 구분한다',()=>{
 assert.deepEqual(categoryTimeValue([{expectedMinutes:60},{expectedMinutes:60}]),{mixed:false,value:60});assert.deepEqual(categoryTimeValue([{},{}]),{mixed:false,value:null});assert.deepEqual(categoryTimeValue([{expectedMinutes:60},{expectedMinutes:90}]),{mixed:true,value:null});assert.deepEqual(categoryTimeValue([{expectedMinutes:60},{}]),{mixed:true,value:null});
});
test('빈칸을 명시적으로 저장하면 전체 시간 해제하고 입력하지 않은 혼합 시간은 유지',()=>{
 const data=fixture(),snapshot=structuredClone(data),cleared=updateStudyCategory(data,'p','특강',{name:'특강',expectedMinutes:null});assert.deepEqual(cleared.catalog.slice(0,2).map(item=>item.expectedMinutes),[null,null]);assert.deepEqual(cleared.catalog.slice(0,2).map(item=>[item.id,item.title,item.category,item.date]),data.catalog.slice(0,2).map(item=>[item.id,item.title,item.category,item.date]));assert.equal(cleared.lectureCompletion,data.lectureCompletion);assert.equal(cleared.catalog[2],data.catalog[2]);assert.equal(cleared.catalog[3],data.catalog[3]);assert.deepEqual(updateStudyCategory(data,'p','특강',{name:'특강',expectedMinutes:undefined}).catalog.slice(0,2).map(item=>item.expectedMinutes),[120,150]);assert.deepEqual(data,snapshot);
});
