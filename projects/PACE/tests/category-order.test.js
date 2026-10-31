import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedCategories,moveCategory,categoryItemGroups} from '../src/category-order.js';

test('나중에 등록한 특강도 분류별로 묶고 드래그 순서·검색 결과·분류 내 순서를 보존한다',()=>{
 const items=[{id:'a',planId:'p',category:'SQL'},{id:'b',planId:'p',category:'기출문제'},{id:'c',planId:'p',category:'기출문제'},{id:'late',planId:'p',category:'SQL'},{id:'other',planId:'q',category:'SQL'}],data={categoryOrder:{p:['SQL','기출문제']}},before=structuredClone(items);
 const grouped=categoryItemGroups(data,'p',items);
 assert.deepEqual(grouped.map(group=>[group.category,group.items.map(item=>item.id)]),[['SQL',['a','late']],['기출문제',['b','c']]]);
 assert.deepEqual(categoryItemGroups(data,'p',items.filter(item=>item.id==='late')).map(group=>group.items.map(item=>item.id)),[['late']]);
 const moved=moveCategory(data,'p',['SQL','기출문제'],'기출문제','SQL');assert.deepEqual(categoryItemGroups(moved,'p',items).map(group=>group.category),['기출문제','SQL']);
 assert.deepEqual(items,before);assert.equal(grouped[0].items[1],items[3]);
});
test('분류 순서만 변경하고 다른 자격증과 항목·완료·색상 데이터는 보존',()=>{
 const data={categoryOrder:{other:['B','A']},catalog:[{id:'1',order:1},{id:'2',order:2}],lectureCompletion:{'1':{completed:true}},categoryColors:{p:{이론:'#abc'}}};
 const categories=['이론','SQL','프로그래밍언어','모의고사'],next=moveCategory(data,'p',categories,'프로그래밍언어','SQL');
 assert.deepEqual(next.categoryOrder.p,['이론','프로그래밍언어','SQL','모의고사']);assert.deepEqual(next.categoryOrder.other,['B','A']);
 assert.equal(next.catalog,data.catalog);assert.equal(next.lectureCompletion,data.lectureCompletion);assert.equal(next.categoryColors,data.categoryColors);assert.equal(data.categoryOrder.p,undefined);
 assert.deepEqual(orderedCategories(JSON.parse(JSON.stringify(next)),'p',categories),next.categoryOrder.p);
});
test('신규 분류는 마지막에 추가하고 삭제된 분류만 제외',()=>{
 const data={categoryOrder:{p:['이론','프로그래밍언어','SQL']}};
 assert.deepEqual(orderedCategories(data,'p',['SQL','이론','프로그래밍언어','복습']),['이론','프로그래밍언어','SQL','복습']);
 assert.deepEqual(orderedCategories(data,'p',['SQL','이론','복습']),['이론','SQL','복습']);
 assert.deepEqual(orderedCategories(data,'other',['SQL','이론']),['SQL','이론']);
});
test('앞뒤 이동과 무효 이동을 안전하게 처리',()=>{
 const data={};assert.deepEqual(moveCategory(data,'p',['A','B','C'],'A','C',true).categoryOrder.p,['B','C','A']);
 assert.equal(moveCategory(data,'p',['A','B'],'A','A'),data);assert.equal(moveCategory(data,'p',['A','B'],'missing','B'),data);
});
