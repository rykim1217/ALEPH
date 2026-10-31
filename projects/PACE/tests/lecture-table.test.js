import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeStudyInput, emptyStudy, registerLectures, lectureItems } from '../src/study.js';

const markdown=readFileSync(new URL('./fixtures/sql-markdown-outline.txt',import.meta.url),'utf8');
for(const format of ['markdown','clipboard'])test(format+': SQL outline has 31 lectures without headings or table headers',()=>{
 const text=format==='markdown'?markdown:markdown.split('\n').filter(line=>!/^\|\s*-/.test(line)).map(line=>line.startsWith('|')?line.slice(1,-1).split('|').map(cell=>cell.trim()).join('\t'):line.replace(/^#+\s*/, '')).join('\n');
 const rows=analyzeStudyInput({kind:'lecture',text,category:'SQLD'});
 assert.equal(rows.length,31);
 assert.deepEqual(rows.slice(0,3).map(row=>[row.number,row.title,row.originalSeconds]),[['2-1','관계형 데이터베이스 개요',2356],['2-2','SELECT 문',2338],['2-3','함수',6800]]);
 assert.equal(rows[8].title,'SQL 기본 종합 문제');assert.equal(rows[9].number,'2-9');
 assert.equal(rows[21].number,'2-20');assert.equal(rows[22].title,'관리 구문 종합 문제');
 assert.equal(rows[30].title,'SQLD 서브쿼리 실전편 특강');assert.equal(rows[30].originalSeconds,3831);
 assert.ok(rows.every(row=>row.originalSeconds>0&&row.category==='SQLD'));
 assert.equal(rows[9].subject,'PART 2. SQL 활용');
 const before=emptyStudy(),registered=registerLectures(before,'p',rows);
 assert.equal(registered.added,31);assert.equal(lectureItems(registered.data)[0].number,'2-1');
 assert.equal(registerLectures(registered.data,'p',rows).added,0);assert.equal(lectureItems(before).length,0);
});

test('table rows without a duration stay editable, without absorbing header or next lecture time',()=>{
 const rows=analyzeStudyInput({kind:'lecture',category:'SQLD',text:'| 강의 | 제목 | 재생시간 |\n| --- | --- | --- |\n| 2-1 | 개요 | |\n| 2-2 | SELECT | 38:58 |'});
 assert.equal(rows.length,2);assert.equal(rows[0].originalSeconds,null);assert.equal(rows[1].originalSeconds,2338);
});

for(const separator of ['\t','  '])test('intro labels and table header are not extra lectures ('+JSON.stringify(separator)+')',()=>{
 const text=[['강의','제목','재생시간'],['인트로','인트로','1:04:06'],['1-1','데이터 모델링 이해','43:07'],['1-2','엔터티','23:06'],['1-3','속성','35:41'],['1-4','관계','21:26'],['1-5','식별자','29:43']].map(cells=>cells.join(separator)).join('\n');
 const rows=analyzeStudyInput({kind:'lecture',category:'데이터 모델링의 이해',text});
 assert.equal(rows.length,6);assert.equal(rows[0].title,'인트로');assert.equal(rows[0].originalSeconds,3846);
 assert.deepEqual(rows.slice(1).map(row=>row.number),['1-1','1-2','1-3','1-4','1-5']);
 assert.equal(rows[1].title,'데이터 모델링 이해');assert.equal(rows[1].originalSeconds,2587);
 assert.equal(registerLectures(emptyStudy(),'p',rows).added,6);
});
