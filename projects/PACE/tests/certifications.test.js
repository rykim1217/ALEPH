import test from 'node:test';
import assert from 'node:assert/strict';
import { CERTIFICATION_STORAGE_KEY, loadCertifications, saveCertifications, upsertCertification, deleteCertification, validateCertification } from '../src/certifications.js';
import { getDaySummary } from '../src/data.js';
const legacyPlans = () => [{id:'practical',name:'정보처리기사 실기',examDate:'2026-10-25',color:'#123456',subjects:['기존 예시'],goalDate:'2026-10-16'},{id:'language',name:'영어 능력 시험',examDate:null,color:'#123456'}];

const values = { name: '새 자격증', examDate: '2026-10-20', color: '#123456' };
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
test('자격증 추가는 고유 ID를 만들고 시험 일정과 색상을 반영하며 학습은 생성하지 않는다', () => {
  const plans = upsertCertification([], values);
  const second = upsertCertification(plans, values);
  assert.notEqual(second[0].id, second[1].id);
  const day = getDaySummary(new Date(2026, 9, 20), plans);
  assert.equal(day.items.length, 0);
  assert.deepEqual(day.special.map(item => [item.title, item.color]), [['새 자격증 시험', '#123456']]);
  assert.equal(getDaySummary(new Date(2026, 9, 19), plans).items.length, 0);
});
test('시험일 미정 자격증을 등록하고 날짜를 설정하거나 다시 지울 수 있다', () => {
  let plans = upsertCertification([], { ...values, examDate: '' });
  assert.equal(plans[0].examDate, null);
  assert.equal(getDaySummary(new Date(2026, 9, 20), plans).special.length, 0);
  plans = upsertCertification(plans, values, plans[0].id);
  assert.equal(getDaySummary(new Date(2026, 9, 20), plans).special.length, 1);
  plans = upsertCertification(plans, { ...values, examDate: null }, plans[0].id);
  assert.equal(getDaySummary(new Date(2026, 9, 20), plans).special.length, 0);
});
test('수정은 ID와 기존 예시 학습 정보를 유지하고 삭제는 대상만 제거한다', () => {
  const defaults = legacyPlans();
  const edited = upsertCertification(defaults, values, 'practical');
  assert.equal(edited[0].id, 'practical');
  assert.deepEqual(edited[0].subjects, defaults[0].subjects);
  assert.equal(edited[1], defaults[1]);
  assert.equal(edited[0].examLabel, '새 자격증 시험');
  assert.equal(getDaySummary(new Date(2026, 9, 25), [edited[0]]).special.some(item => item.type === 'exam'), false);
  assert.deepEqual(deleteCertification(edited, 'practical'), [defaults[1]]);
  assert.equal(defaults[0].name, '정보처리기사 실기');
});
test('자격증 변경·삭제 및 필터와 무관하게 개인 일정과 저장 내용은 유지된다', () => {
  const store = storage();
  const personal = [{ id: 'personal', date: '2026-10-20', title: '병원 예약' }];
  store.setItem('pace.personal-events.v1', JSON.stringify(personal));
  let plans = upsertCertification([], values);
  plans = upsertCertification(plans, { ...values, name: '수정한 이름' }, plans[0].id);
  saveCertifications(store, plans);
  for (const selection of [plans, [plans[0]], deleteCertification(plans, plans[0].id)]) {
    assert.equal(getDaySummary(new Date(2026, 9, 20), selection, personal).special.some(item => item.id === 'personal'), true);
  }
  saveCertifications(store, []);
  assert.equal(store.getItem('pace.personal-events.v1'), JSON.stringify(personal));
});
test('저장 복원은 최초 기본값과 모두 삭제한 빈 목록을 구분한다', () => {
  const store = storage(), defaults = legacyPlans();
  assert.equal(loadCertifications(store, defaults).length, 2);
  const plans = upsertCertification([], { ...values, examDate: '' });
  saveCertifications(store, plans);
  assert.deepEqual(loadCertifications(store, defaults), plans);
  saveCertifications(store, []);
  assert.deepEqual(loadCertifications(store, defaults), []);
});
test('이름·실제 날짜·색상·저장 데이터·저장 실패를 검증한다', () => {
  for (const input of [{ ...values, name: '  ' }, { ...values, name: '가'.repeat(61) }, { ...values, examDate: '2026-02-30' }, { ...values, examDate: '0000-01-01' }, { ...values, color: 'red' }]) assert.throws(() => validateCertification(input));
  assert.equal(validateCertification({ ...values, name: '  자격증  ', examDate: '2024-02-29' }).name, '자격증');
  assert.throws(() => upsertCertification([], values, 'missing'));
  const store = storage(); store.setItem(CERTIFICATION_STORAGE_KEY, '{}');
  assert.throws(() => loadCertifications(store, []));
  store.setItem(CERTIFICATION_STORAGE_KEY, 'invalid json');
  assert.throws(() => loadCertifications(store, []));
  assert.throws(() => saveCertifications({ setItem() { throw new Error('QuotaExceededError'); } }, []));
});
import { updateCertificationDetails, validateGoal } from '../src/certifications.js';
test('자격증과 목표는 함께 저장하고 다른 자격증 및 관련 저장 데이터를 보존한다', () => {
  const original=legacyPlans();const before=JSON.stringify(original);const goals=[{id:'g1',title:' 기본 강의 1회독 완료 ',date:'2026-10-14',source:'user'}];
  const store=storage();store.setItem('pace.personal-events.v1','personal');store.setItem('pace.availability.v2','availability');
  const changed=updateCertificationDetails(original,'practical',{...values,examDate:null},goals);
  assert.equal(JSON.stringify(original),before);assert.equal(changed[1],original[1]);assert.deepEqual(changed[0].subjects,original[0].subjects);assert.equal(changed[0].goals[0].title,'기본 강의 1회독 완료');
  saveCertifications(store,changed);const restored=loadCertifications(store,[]);assert.deepEqual(restored[0].goals,changed[0].goals);assert.equal(store.getItem('pace.personal-events.v1'),'personal');assert.equal(store.getItem('pace.availability.v2'),'availability');
});
test('목표 일정은 해당 자격증 필터와 날짜에만 표시하고 개인 일정은 유지한다', () => {
  const plans=updateCertificationDetails(legacyPlans(),'practical',values,[{id:'g',title:'목표',date:'2026-10-14'}]);
  const goals=plans.flatMap(plan=>(plan.goals||[]).map(goal=>({...goal,planId:plan.id})));
  const personal=[{id:'p',title:'개인',date:'2026-10-14'}];
  assert.deepEqual(getDaySummary(new Date(2026,9,14),plans,personal,{goals}).special.map(s=>s.type),['goal','personal']);
  assert.deepEqual(getDaySummary(new Date(2026,9,14),[plans[1]],personal,{goals}).special.map(s=>s.type),['personal']);
  assert.equal(getDaySummary(new Date(2026,9,15),plans,[],{goals}).special.length,0);
});
test('목표 수정·삭제는 복사한 목록에서 처리하고 취소한 원본은 보존한다', () => {
  const original=updateCertificationDetails(legacyPlans(),'practical',values,[{id:'g1',title:'원래 목표',date:'2026-10-14'},{id:'g2',title:'다른 목표',date:'2026-10-15'}]);
  const draft=original[0].goals.map(g=>({...g}));draft[0].title='수정 목표';draft.pop();
  assert.equal(original[0].goals.length,2);assert.equal(original[0].goals[0].title,'원래 목표');
  const saved=updateCertificationDetails(original,'practical',values,draft);assert.equal(saved[0].goals.length,1);assert.equal(saved[0].goals[0].title,'수정 목표');
  assert.equal(updateCertificationDetails(saved,'practical',values,[])[0].goals.length,0);
});
test('잘못된 목표·중복 ID를 저장하지 않고 신규 자격증에는 목표를 자동 추가하지 않는다', () => {
  for(const goal of [{id:'g',title:'',date:'2026-10-14'},{id:'g',title:'목표',date:''},{id:'g',title:'목표',date:'2026-02-30'}])assert.throws(()=>validateGoal(goal));
  const goal={id:'g',title:'목표',date:'2026-10-14'};assert.throws(()=>updateCertificationDetails(legacyPlans(),'practical',values,[goal,goal]));
  assert.equal(upsertCertification([],values)[0].goals,undefined);
});
