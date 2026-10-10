import test from 'node:test';
import assert from 'node:assert/strict';
import {configureMilestone,resolvedMilestoneCategories,milestoneCategories,updateCertificationDetails,saveCertifications,loadCertifications} from '../src/certifications.js';
import {emptyStudy} from '../src/study.js';
import {updateStudyCategory} from '../src/study-item-edit.js';
const goal={id:'goal-1',title:'1회독 완료',date:'2026-10-14',color:'#ffdd66',custom:'keep'};
const study=()=>({...emptyStudy(),catalog:[{id:'a',planId:'p',category:'이론',studyKind:'lecture',date:'2026-10-12',originalSeconds:3600},{id:'b',planId:'p',category:'SQL',studyKind:'lecture'},{id:'c',planId:'q',category:'기타',studyKind:'other'}],lectureCompletion:{a:{completed:true}},categoryColors:{p:{이론:'#aa66cc'}},categoryOrder:{p:['SQL','이론']}});
const plans=()=>[{id:'p',name:'정보처리기사 실기',examDate:'2026-10-25',color:'#F06B85',goals:[goal]},{id:'q',name:'다른 자격증',examDate:null,color:'#F06B85',goals:[]}];
test('기존 목표 ID·제목·날짜·색상 및 학습 기록을 보존하고 다중 분류 이정표 저장·복원',()=>{
 const data=study(),snapshot=structuredClone(data),original=plans(),linked=configureMilestone(goal,data,'p',true,['이론','SQL']);
 assert.equal(linked.id,goal.id);assert.equal(linked.title,goal.title);assert.equal(linked.date,goal.date);assert.equal(linked.color,goal.color);assert.equal(linked.milestone.planId,'p');assert.equal(linked.milestone.date,goal.date);
 const next=updateCertificationDetails(original,'p',original[0],[linked]);let saved;saveCertifications({setItem:(key,value)=>saved=value},next);const restored=loadCertifications({getItem:()=>saved},[]);assert.deepEqual(restored[0].goals[0],linked);assert.deepEqual(restored[1],original[1]);assert.deepEqual(data,snapshot);assert.deepEqual(original,plans());
});
test('자격증별 실제 분류만 선택하고 비어 있거나 타 자격증 분류는 저장하지 않는다',()=>{
 const data=study();assert.deepEqual(milestoneCategories(data,'p'),['SQL','이론']);assert.deepEqual(milestoneCategories(data,'q'),['기타']);assert.throws(()=>configureMilestone(goal,data,'p',true,[]));assert.throws(()=>configureMilestone(goal,data,'p',true,['기타']));const linked=configureMilestone(goal,data,'q',true,['기타']);assert.throws(()=>updateCertificationDetails(plans(),'p',plans()[0],[linked]));
});
test('분류명 변경 후 기존 항목 ID로 연결을 유지하며 새 항목도 현재 분류의 대상',()=>{
 const data=study(),linked=configureMilestone(goal,data,'p',true,['이론']);const renamed=updateStudyCategory(data,'p','이론',{name:'핵심 이론'});renamed.catalog.push({id:'new',planId:'p',category:'핵심 이론',studyKind:'lecture'});assert.deepEqual(resolvedMilestoneCategories(renamed,'p',linked.milestone),['핵심 이론']);assert.deepEqual(renamed.lectureCompletion,data.lectureCompletion);assert.equal(renamed.catalog[0].date,data.catalog[0].date);
});
test('연결 해제·여러 이정표·일반 목표 수정 삭제는 학습 데이터에 영향을 주지 않는다',()=>{
 const data=study(),snapshot=structuredClone(data),linked=configureMilestone(goal,data,'p',true,['SQL']),ordinary=configureMilestone(linked,data,'p',false),second=configureMilestone({...goal,id:'goal-2',date:'2026-10-15'},data,'p',true,['이론']);assert.equal(ordinary.milestone.enabled,false);assert.equal(ordinary.id,goal.id);assert.deepEqual(resolvedMilestoneCategories(data,'p',ordinary.milestone),[]);const initial=plans();const next=updateCertificationDetails(initial,'p',initial[0],[ordinary,second]);assert.equal(next[0].goals.length,2);const deleted=updateCertificationDetails(next,'p',next[0],[second]);assert.equal(deleted[0].goals[0].id,'goal-2');assert.deepEqual(data,snapshot);
});
