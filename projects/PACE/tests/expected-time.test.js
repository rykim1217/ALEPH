import test from 'node:test';import assert from 'node:assert/strict';
import {emptyStudy,analyzeStudyInput,registerLectures,generateStudyRange,lectureItems,parseExpectedMinutes,formatExpectedMinutes} from '../src/study.js';
import {updateStudyItem} from '../src/study-item-edit.js';
test('교재·복습·기타는 선택 시간과 항목별 시간을 저장하고 원본 시간을 만들지 않는다',()=>{
 for(const kind of ['book','review','other']){const rows=analyzeStudyInput({kind,category:kind,text:'첫 항목\n둘째 항목\n셋째 항목'});rows[0].expectedMinutes=30;rows[1].expectedMinutes=45;
 const next=registerLectures(emptyStudy(),'p',rows).data;assert.deepEqual(next.catalog.map(i=>i.expectedMinutes),[30,45,undefined]);assert.ok(next.catalog.every(i=>i.originalSeconds===null));assert.equal(formatExpectedMinutes(45),'45분');}
});
test('기출·모의고사 공통 시간, 회차별 수정, 미입력, 잘못된 시간을 검증',()=>{
 for(const kind of ['past','mock']){const rows=generateStudyRange({kind,startYear:2023,endYear:2025,rounds:[1,2,3],startRound:1,endRound:20,expectedMinutes:120});assert.ok(rows.every(i=>i.expectedMinutes===120));rows[4].expectedMinutes=150;const data=registerLectures(emptyStudy(),'p',rows).data;assert.equal(data.catalog[4].expectedMinutes,150);}
 assert.equal(parseExpectedMinutes('  '),null);assert.equal(parseExpectedMinutes('2.5'),2.5);assert.equal(formatExpectedMinutes(undefined),'');
 for(const expectedMinutes of [0,-1,NaN,Infinity])assert.throws(()=>generateStudyRange({kind:'mock',startRound:1,endRound:2,expectedMinutes}));
});
test('예상 시간 수정 및 제거는 완료·날짜·원본 시간과 다른 항목을 보존',()=>{
 const rows=analyzeStudyInput({kind:'book',category:'교재',text:'한 항목'}),data=registerLectures(emptyStudy(),'p',rows).data,id=data.catalog[0].id;data.catalog[0].date='2026-10-10';data.lectureCompletion={[id]:{completed:true}};
 const next=updateStudyItem(data,id,{expectedMinutes:30});assert.equal(lectureItems(next)[0].expectedMinutes,30);assert.deepEqual(next.lectureCompletion,data.lectureCompletion);assert.equal(next.catalog[0].date,'2026-10-10');assert.equal(next.catalog[0].originalSeconds,null);assert.equal(updateStudyItem(next,id,{expectedMinutes:null}).catalog[0].expectedMinutes,null);assert.throws(()=>updateStudyItem(next,id,{expectedMinutes:0}));assert.equal(data.catalog[0].expectedMinutes,undefined);
});
