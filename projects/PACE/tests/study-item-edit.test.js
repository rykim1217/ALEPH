import {importStudy} from './fixtures/synthetic-study.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStudy,lectureItems,loadStudy} from '../src/study.js';
import {updateStudyItem,deleteStudyItems} from '../src/study-item-edit.js';
const catalog=[{id:'a',planId:'p',category:'이론',number:'1.10',title:'공학',originalSeconds:1920,studyKind:'lecture',order:1,date:'2026-10-10',subject:'1과목'}, {id:'b',planId:'p',category:'SQL',number:'1',title:'DDL',originalSeconds:1945,studyKind:'lecture',order:2},{id:'c',planId:'q',category:'이론',title:'다른 항목',studyKind:'book',order:1}];
const fixture=()=>({...emptyStudy(),catalog:structuredClone(catalog),lectureCompletion:{a:{completed:true,at:'saved'},b:{completed:false},c:{completed:true}},categoryColors:{p:{이론:'#123456'}},settings:{preserve:true}});
test('개별 수정은 ID·번호 문자열·배정·과목·완료와 다른 데이터를 보존하고 재실행 후 유지',()=>{
 const before=fixture(),snapshot=structuredClone(before),next=updateStudyItem(before,'a',{title:'새 공학',category:'새 분류',number:'1.11',originalSeconds:3718});
 assert.deepEqual(before,snapshot);assert.deepEqual(next.lectureCompletion,before.lectureCompletion);assert.deepEqual(next.catalog.slice(1),before.catalog.slice(1));
 assert.equal(next.catalog[0].id,'a');assert.equal(next.catalog[0].date,'2026-10-10');assert.equal(next.catalog[0].subject,'1과목');assert.equal(next.catalog[0].number,'1.11');
 assert.deepEqual(loadStudy({getItem:()=>JSON.stringify(next)}),next);assert.equal(lectureItems(next)[0].completed,true);assert.deepEqual(next.settings,before.settings);
 assert.throws(()=>updateStudyItem(before,'a',{originalSeconds:null}));assert.throws(()=>updateStudyItem(before,'a',{category:' '}));assert.throws(()=>updateStudyItem(before,'a',{number:''}));
});
test('여러 분류 선택 삭제는 대상 자격증의 선택 항목과 기록만 정리',()=>{
 const before=fixture(),next=deleteStudyItems(before,'p',['a','b']);assert.deepEqual(next.catalog,[before.catalog[2]]);assert.deepEqual(next.lectureCompletion,{c:{completed:true}});assert.deepEqual(next.categoryColors,before.categoryColors);assert.deepEqual(next.settings,before.settings);assert.equal(before.catalog.length,3);
 assert.throws(()=>deleteStudyItems(before,'p',['a','c']));assert.throws(()=>deleteStudyItems(before,'p',['missing']));assert.throws(()=>deleteStudyItems(before,'p',[]));
});
test('공유 날짜 일정은 일부 삭제 시 유지하고 마지막 항목 삭제 시 해당 일정만 제거',()=>{
 const plans=[{id:'p',name:'정보처리기사 실기',goals:[]}],before=importStudy(emptyStudy(),plans).data;
 const first=lectureItems(before)[0],siblings=lectureItems(before).filter(i=>i.recordId===first.recordId);
 const partial=deleteStudyItems(before,'p',[first.id]);assert.equal(partial.records.length,16);assert.equal(lectureItems(partial).length,107);assert.equal(lectureItems(loadStudy({getItem:()=>JSON.stringify(partial)})).some(i=>i.id===first.id),false);
 const all=deleteStudyItems(partial,'p',siblings.slice(1).map(i=>i.id));assert.equal(all.records.length,15);assert.ok(!all.completion[first.recordId]);assert.deepEqual(all.imports,before.imports);assert.deepEqual(all.records,before.records.slice(1));
});
