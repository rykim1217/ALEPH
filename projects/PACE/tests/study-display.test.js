import test from 'node:test';import assert from 'node:assert/strict';
import {studyDisplayName,studyFullTitle} from '../src/study-display.js';
test('保存된 번호·연도·회차만 표시하고 전체 제목과 원본 데이터를 보존',()=>{
 const item={category:'이론',number:'1.10',title:'긴 소프트웨어 강의명',studyKind:'lecture'},snapshot=structuredClone(item);assert.equal(studyDisplayName(item),'이론 1.10');assert.equal(studyFullTitle(item),'이론 1.10 긴 소프트웨어 강의명');assert.deepEqual(item,snapshot);
 assert.equal(studyDisplayName({category:'프로그래밍언어',number:'35',title:'static 변수와 메서드'}),'프로그래밍언어 35');
 assert.equal(studyDisplayName({category:'기출문제',studyKind:'past',year:2024,round:1,title:'다른 제목'}),'기출문제 2024년 1회');assert.equal(studyDisplayName({category:'모의고사',studyKind:'mock',round:3,title:'시대고시 모의고사 3회'}),'모의고사 3회');
});
test('번호가 없으면 제목의 숫자를 추출하지 않고 전체 제목 사용',()=>{for(const studyKind of ['book','review','other','lecture','mock']){const item={studyKind,category:'분류',title:'2024년 35장 복습'};assert.equal(studyDisplayName(item),item.title);assert.equal(studyFullTitle(item),item.title);}});
