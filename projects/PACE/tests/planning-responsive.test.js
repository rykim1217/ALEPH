import test from 'node:test';
import assert from 'node:assert/strict';
import {planningVisibleDates} from '../src/study-planning.js';
const keys=days=>days.map(d=>`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`);
test('tablet centers today and advances naturally across months',()=>{
 assert.deepEqual(keys(planningVisibleDates(new Date(2026,9,11),5)),['2026-10-9','2026-10-10','2026-10-11','2026-10-12','2026-10-13']);
 assert.equal(planningVisibleDates(new Date(2026,9,12),5)[2].getDate(),12);
 assert.deepEqual(keys(planningVisibleDates(new Date(2027,0,1),5)),['2026-12-30','2026-12-31','2027-1-1','2027-1-2','2027-1-3']);
});
test('phone shows one date; desktop respects saved week start without mutating anchor',()=>{
 const anchor=new Date(2026,9,11),stamp=anchor.getTime();
 assert.deepEqual(keys(planningVisibleDates(anchor,1)),['2026-10-11']);
 assert.equal(planningVisibleDates(anchor,7,0)[0].getDay(),0);
 assert.equal(planningVisibleDates(anchor,7,1)[0].getDay(),1);
 assert.equal(anchor.getTime(),stamp);
});

test('tablet three-day window keeps today in the middle across year boundaries',()=>{
 assert.deepEqual(keys(planningVisibleDates(new Date(2026,9,11),3)),['2026-10-10','2026-10-11','2026-10-12']);
 assert.deepEqual(keys(planningVisibleDates(new Date(2027,0,1),3)),['2026-12-31','2027-1-1','2027-1-2']);
});
