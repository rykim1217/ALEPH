import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, monthCells, shiftMonth, daysBetween, formatMinutes } from '../src/calendar.js';
import { getDaySummary } from '../src/data.js';
test('월간 캘린더는 일요일부터 토요일까지 실제 날짜를 누락 없이 표시한다', () => {
  for (const [year, month] of [[2026, 9], [2024, 1], [2026, 1], [2026, 7]]) {
    const cells = monthCells(year, month);
    assert.equal(cells.length % 7, 0); assert.equal(cells[0].getDay(), 0); assert.equal(cells.at(-1).getDay(), 6);
    assert.equal(cells.filter(date => date.getMonth() === month).length, new Date(year, month + 1, 0).getDate());
    assert.equal(new Set(cells.map(dateKey)).size, cells.length);
  }
});
test('월 이동은 연도 경계에서도 올바르게 동작한다', () => {
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
});
test('날짜와 시간 표시', () => {
  assert.equal(dateKey(new Date(2026, 0, 2)), '2026-01-02');
  assert.equal(daysBetween(new Date(2026, 9, 9), new Date(2026, 10, 14)), 36);
  assert.equal(formatMinutes(120), '2시간'); assert.equal(formatMinutes(90), '1시간 30분'); assert.equal(formatMinutes(0), '0시간');
});

test('6주 달력과 시험일까지 남은 날짜를 계산한다', () => { assert.equal(monthCells(2026, 7).length, 42); assert.equal(daysBetween(new Date(2026,9,9),new Date(2026,9,25)),16); });
test('저장된 옛 예시 필드로 반복 학습·목표·휴식·가능 시간을 생성하지 않는다', () => {
 const legacy = {id:'practical',name:'기존 자격증',examDate:'2026-10-25',subjects:['데이터베이스 7강','SQL 8강','프로그래밍 4강'],goalDate:'2026-10-16',goalName:'예시 목표',restDates:['2026-10-11']};
 for(const date of [9,11,16,25]) { const day=getDaySummary(new Date(2026,9,date),[legacy]); assert.equal(day.items.length,0);assert.equal(day.capacity,null);assert.equal(day.total,null);assert.equal(day.rest,false);assert.equal(day.special.some(e=>e.type==='goal'),false); }
 assert.equal(getDaySummary(new Date(2026,9,25),[legacy]).special[0].title,'기존 자격증 시험');assert.equal(legacy.subjects.length,3);
});
test('명시적 실제 학습·가능 시간·목표만 집계하고 필터와 개인 일정을 유지한다',()=>{
 const plans=[{id:'a',name:'A',examDate:null},{id:'b',name:'B',examDate:'2026-10-09'}],personal=[{id:'p',date:'2026-10-09',title:'예약'}];
 const records={studyItems:[{id:'1',planId:'a',date:'2026-10-09',title:'실제 학습',minutes:30},{id:'2',planId:'b',date:'2026-10-09',minutes:40},{id:'3',planId:'a',date:'2026-10-09',minutes:48,source:'demo'}],availability:{'2026-10-09':120},goals:[{planId:'a',date:'2026-10-09',title:'실제 목표',source:'user'}]};
 const all=getDaySummary(new Date(2026,9,9),plans,personal,records);assert.equal(all.total,70);assert.equal(all.capacity,120);
 const filtered=getDaySummary(new Date(2026,9,9),[plans[0]],personal,records);assert.equal(filtered.total,30);assert.equal(filtered.capacity,120);assert.deepEqual(filtered.special.map(e=>e.type),['goal','personal']);
 const empty=getDaySummary(new Date(2026,9,9),[],personal);assert.equal(empty.special[0].id,'p');assert.equal(empty.total,null);assert.equal(empty.capacity,null);
});
test('명시적인 0분과 미설정을 구분한다',()=>{assert.equal(getDaySummary(new Date(2026,9,9),[],[],{availability:{'2026-10-09':0}}).capacity,0);assert.equal(getDaySummary(new Date(2026,9,9),[],[],{availability:{'2026-10-09':-1}}).capacity,null);});
import {detailPlacement} from '../src/calendar.js';
test('상세 팝업은 위/아래/좌우에서 선택 칸을 가리지 않고 화면 안에 배치한다',()=>{for(const cell of [{left:400,right:600,top:180,bottom:350},{left:1000,right:1200,top:520,bottom:690},{left:1700,right:1900,top:850,bottom:1020}])for(const height of [450,720]){const p=detailPlacement(cell,364,height,1920,1080);assert.equal(p.fullscreen,undefined);assert.ok(p.x>=16&&p.y>=16&&p.x+364<=1904&&p.y+height<=1064);assert.ok(p.x>=cell.right||p.x+364<=cell.left||p.y>=cell.bottom||p.y+height<=cell.top);}assert.equal(detailPlacement({left:10,right:60,top:300,bottom:380},364,700,390,844).fullscreen,true);});
import {attachedEditorPlacement} from '../src/calendar.js';
test('옆 편집창은 상세 위치 변경 없이 화면 안에서 날짜 칸과 상세를 피한다',()=>{const cell={left:1700,right:1900,top:900,bottom:1060},detail={left:1540,right:1904,top:420,bottom:880};const p=attachedEditorPlacement(detail,cell,340,260,1920,1080);assert.equal(p.x,1190);assert.equal(p.y,420);assert.equal(attachedEditorPlacement(detail,cell,340,260,390,844).fullscreen,true);const leftDetail={left:600,right:964,top:400,bottom:860};const right=attachedEditorPlacement(leftDetail,{left:400,right:590,top:400,bottom:550},340,260,1920,1080);assert.equal(right.x,974);});
import { datePickerPlacement } from '../src/calendar.js';
test('날짜 선택 팝업은 아래 공간이 부족하면 위쪽에 표시하고 좌우 경계를 지킨다',()=>{
  const bounds={left:650,right:1270,top:240,bottom:840};
  assert.deepEqual(datePickerPlacement({left:673,top:350,bottom:393},bounds,300,292,1920,1080),{x:673,y:399});
  assert.deepEqual(datePickerPlacement({left:1120,top:700,bottom:743},bounds,300,292,1920,1080),{x:958,y:402});
});
test('작은 화면의 날짜 팝업은 화면 내부에 유지한다',()=>{
  const p=datePickerPlacement({left:280,top:490,bottom:533},{left:12,right:378,top:20,bottom:620},300,292,390,640);
  assert.ok(p.x>=12&&p.x+300<=378);assert.ok(p.y>=12&&p.y+292<=628);
});
