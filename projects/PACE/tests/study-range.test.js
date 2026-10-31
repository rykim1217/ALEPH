import {importStudy} from './fixtures/synthetic-study.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {generateStudyRange,formatLectureTime,parseLectureTime,registerLectures,emptyStudy,lectureItems} from '../src/study.js';
test('시간 표시와 편집은 초까지 정확하게 왕복하고 잘못된 입력을 거부한다',()=>{for(const n of [1920,2340,3900,3907,7])assert.equal(parseLectureTime(formatLectureTime(n)),n);assert.equal(formatLectureTime(3900),'65분');for(const [seconds,label] of [[1920,'32분'],[1945,'32분 25초'],[3600,'60분'],[3718,'61분 58초'],[4085,'68분 5초']]){assert.equal(formatLectureTime(seconds),label);assert.equal(parseLectureTime(label),seconds);}assert.equal(parseLectureTime('잘못된 시간'),null);});
test('기출 연도와 자유 회차 조합은 9개 생성하며 제외와 중복 등록을 지원한다',()=>{const rows=generateStudyRange({kind:'past',startYear:2023,endYear:2025,rounds:[1,2,3]});assert.equal(rows.length,9);const selected=rows.slice(1);const first=registerLectures(emptyStudy(),'p',selected);assert.equal(first.added,8);assert.equal(registerLectures(first.data,'p',selected.map(r=>({...r,title:'수정된 제목',category:'다른 분류'}))).added,0);assert.equal(generateStudyRange({kind:'past',startYear:2023,endYear:2023,rounds:[4,10]}).length,2);});

test('기출 연도는 선택이며 연도 없는 회차는 연도별 기출과 구분해서 중복 검사한다',()=>{
 const rows=generateStudyRange({kind:'past',startYear:'',endYear:'',rounds:[3,1,1],expectedMinutes:60});
 assert.deepEqual(rows.map(row=>[row.title,row.year,row.round]),[['기출문제 1회',null,1],['기출문제 3회',null,3]]);
 const first=registerLectures(emptyStudy(),'p',rows);assert.equal(first.added,2);
 assert.equal(registerLectures(first.data,'p',rows.map(row=>({...row,title:'수정한 제목',category:'별도 분류'}))).added,0);
 const dated=generateStudyRange({kind:'past',startYear:2026,endYear:2026,rounds:[1,3]});
 assert.equal(registerLectures(first.data,'p',dated).added,2);
 assert.ok(rows.every(row=>row.expectedMinutes===60));
 for(const options of [{startYear:2026},{endYear:2026}])assert.equal(generateStudyRange({kind:'past',rounds:[1],...options})[0].title,'2026년 기출문제 1회');
 for(const options of [{startYear:1899},{endYear:'bad'},{startYear:2026,endYear:2025}])assert.throws(()=>generateStudyRange({kind:'past',rounds:[1],...options}));
 assert.throws(()=>generateStudyRange({kind:'past',rounds:[]}));
});
test('모의고사 이름은 선택이며 1~20회 생성과 이름별 중복 구분을 유지한다',()=>{const rows=generateStudyRange({kind:'mock',startRound:1,endRound:20});assert.equal(rows.length,20);assert.equal(rows[0].title,'모의고사 1회');const first=registerLectures(emptyStudy(),'p',rows);assert.equal(registerLectures(first.data,'p',rows).added,0);const named=generateStudyRange({kind:'mock',name:'시대고시',startRound:1,endRound:20});assert.equal(named[19].title,'시대고시 모의고사 20회');assert.equal(registerLectures(first.data,'p',named).added,20);assert.throws(()=>generateStudyRange({kind:'mock',startRound:2,endRound:1}));});
test('일괄 등록은 기존 108강 ID 완료 기록 원본 16일치 데이터를 보존한다',()=>{const {data}=importStudy(emptyStudy(),[{id:'p',name:'정보처리기사 실기',goals:[]}]);const before=structuredClone(data);const lectures=lectureItems(data);const next=registerLectures(data,'p',generateStudyRange({kind:'mock',startRound:1,endRound:20})).data;assert.deepEqual(data,before);assert.deepEqual(next.records,data.records);assert.deepEqual(next.completion,data.completion);assert.deepEqual(lectureItems(next).slice(0,108),lectures);});
