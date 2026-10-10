import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeStudyInput,registerLectures,emptyStudy} from '../src/study.js';import {planningMinutes} from '../src/study-planning.js';
const first=`1과목. 데이터 모델링의 이해
1장. 데이터 모델링의 이해
1.1 데이터 모델의 이해
1.2 데이터 모델링의 중요성
2장. 데이터 모델과 SQL
2.1 엔터티의 개념과 특징`;
const second=`2과목. SQL 기본 및 활용
3장. SQL 기본
3.1 관계형 데이터베이스 개요
3.2 SELECT 문
4장. SQL 활용
4.1 집합 연산자
5장. 실전 문제
5.2 SQL 기본 연습문제
5.5 실전 모의고사 2회`;
const parse=text=>analyzeStudyInput({kind:'book',text,category:'SQLD'});
test('한 과목·과목 없는 목차는 원본 소단원 번호 유지하고 구조 제목 제외',()=>{assert.deepEqual(parse(first).map(row=>row.number),['1.1','1.2','2.1']);assert.deepEqual(parse(second).map(row=>row.number),['3.1','3.2','4.1','5.2','5.5']);assert.deepEqual(parse(first.split('\n').slice(1).join('\n')).map(row=>row.number),['1.1','1.2','2.1']);assert.equal(parse(first).length,3);});
test('여러 과목만 과목 번호 추가하고 원본 장 번호·이미 3단계 번호 유지',()=>{const rows=parse(first+'\n'+second);assert.deepEqual(rows.map(row=>row.number),['1.1.1','1.1.2','1.2.1','2.3.1','2.3.2','2.4.1','2.5.2','2.5.5']);assert.equal(new Set(rows.map(row=>row.number)).size,rows.length);assert.equal(parse(first+'\n2과목. SQL\n2.5.5 실전 문제').at(-1).number,'2.5.5');});
test('불명확한 목차는 새 번호나 시간을 만들지 않고 수정 가능',()=>{const rows=parse('복습 내용\n5.5 실전 모의고사 2회');assert.equal(rows[0].number,undefined);assert.equal(rows[0].title,'복습 내용');assert.equal(rows[1].number,'5.5');assert.ok(rows.every(row=>row.expectedMinutes==null));assert.ok(rows.every(row=>planningMinutes(row,2)===null));});
test('번호·제목·선택 시간 수정 후 등록, 같은 제목 다른 번호 보존 및 원본 데이터 유지',()=>{const rows=parse(first+'\n'+second),study=emptyStudy(),snapshot=structuredClone(study);rows[0].number='1.1.9';rows[0].title='수정 제목';rows[0].expectedMinutes=45;const result=registerLectures(study,'p',rows);assert.equal(result.added,8);assert.equal(result.data.catalog[0].number,'1.1.9');assert.equal(result.data.catalog[0].title,'수정 제목');assert.equal(planningMinutes(result.data.catalog[0],2),45);assert.ok(result.data.catalog.slice(1).every(row=>row.expectedMinutes==null));assert.deepEqual(study,snapshot);assert.equal(registerLectures(emptyStudy(),'p',parse('1.1 연습문제\n2.1 연습문제')).added,2);});
