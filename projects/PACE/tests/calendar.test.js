import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, monthCells, shiftMonth, daysBetween, formatMinutes } from '../src/calendar.js';
import { canSchedulePlanStudy, createDemoPlans, getDemoDay, studyColors } from '../src/data.js';
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
test('시험·목표·휴식과 학습 유형이 예시 데이터에서 구분된다', () => {
  const plan = createDemoPlans(new Date(2026, 9, 9))[0];
  const today = getDemoDay(new Date(2026, 9, 9), plan);
  assert.equal(today.total, 125); assert.equal(today.capacity, 145);
  assert.equal(getDemoDay(new Date(2026, 9, 11), plan).rest, true);
  const workingSunday = getDemoDay(new Date(2026, 9, 18), plan);
  assert.equal(workingSunday.rest, false);
  assert.deepEqual(workingSunday.items.map(item => item.type), ['review']);
  assert.equal(plan.examDate, '2026-10-25');
  assert.equal(plan.goalDate, '2026-10-16');
  assert.equal(getDemoDay(new Date(2026, 9, 25), plan).special[0].title, '실기 시험');
  assert.equal(getDemoDay(new Date(2026, 9, 25), plan).items.length, 0);
  assert.equal(getDemoDay(new Date(2026, 9, 16), plan).special[0].title, '이론 완료 목표');
  assert.deepEqual(getDemoDay(new Date(2026, 9, 9), plan).items.map(item => item.type), ['lecture', 'practice', 'review']);
  assert.deepEqual(getDemoDay(new Date(2026, 9, 7), plan).items.map(item => item.type), ['practice']);
  assert.equal(getDemoDay(new Date(2026, 9, 22), plan).special.length, 0);
  assert.equal(today.items[0].color, studyColors.lecture);
  assert.equal(today.items[1].color, studyColors.practice);
  assert.equal(today.items[2].color, studyColors.review);
});
test('6주 캘린더 달과 실제 시험일까지 남은 날짜를 계산한다', () => {
  const sixWeekMonth = monthCells(2026, 7);
  assert.equal(sixWeekMonth.length, 42);
  const plan = createDemoPlans(new Date(2026, 9, 9))[0];
  assert.equal(daysBetween(new Date(2026, 9, 9), new Date(`${plan.examDate}T00:00:00`)), 16);
});
test('시험별 예시 학습 일정은 시험일 전까지만 생성하고 시험일 라벨은 유지한다', () => {
  const [practical, language] = createDemoPlans(new Date(2026, 9, 9));
  const day = (value, plan) => getDemoDay(new Date(`${value}T00:00:00`), plan);
  assert.equal(canSchedulePlanStudy(new Date('2026-10-24T00:00:00'), practical), true);
  assert.equal(day('2026-10-24', practical).items.length > 0, true);
  assert.equal(canSchedulePlanStudy(new Date('2026-10-25T00:00:00'), practical), false);
  assert.equal(day('2026-10-25', practical).items.length, 0);
  assert.equal(day('2026-10-25', practical).special.find(item => item.type === 'exam').title, '실기 시험');
  for (const date of ['2026-10-26', '2026-11-15', '2026-12-15']) {
    assert.equal(day(date, practical).items.length, 0, `${date} has no practical-plan study items`);
  }
  assert.equal(day('2026-11-20', language).items.length > 0, true);
  assert.equal(day('2026-11-22', language).items.length, 0);
});
test('전체 일정은 시험별 학습을 합치되 학습 가능시간은 하루 기준으로 한 번만 계산한다', () => {
  const plans = createDemoPlans(new Date(2026, 9, 9));
  const day = getDemoDay(new Date(2026, 9, 9), plans);
  assert.equal(day.items.length, 6);
  assert.equal(day.capacity, 145);
  assert.equal(new Set(day.items.map(item => item.planId)).size, 2);
});
test('개별 시험 필터는 해당 시험의 일정만 보여주고 개인 일정은 항상 포함한다', () => {
  const [practical, language] = createDemoPlans(new Date(2026, 9, 9));
  const appointment = { id: 'personal-1', date: '2026-10-16', title: '병원 예약' };
  const practicalDay = getDemoDay(new Date(2026, 9, 16), [practical], [appointment]);
  assert.equal(practicalDay.items.every(item => item.planId === 'practical'), true);
  assert.deepEqual(practicalDay.special.map(item => item.type), ['goal', 'personal']);
  assert.equal(practicalDay.capacity, 145);
  const languageDay = getDemoDay(new Date(2026, 9, 16), [language], [appointment]);
  assert.equal(languageDay.special.some(item => item.type === 'goal'), false);
  assert.equal(languageDay.special.some(item => item.type === 'personal'), true);
});
test('시험일이 없는 상시 학습 계획은 날짜 경계 없이 학습을 표시할 수 있다', () => {
  const plan = { id: 'toeic', name: 'TOEIC', examDate: null, subjects: ['독해', '문제풀이', '어휘'], restDates: [] };
  const date = new Date('2026-12-07T00:00:00');
  assert.equal(canSchedulePlanStudy(date, plan), true);
  assert.equal(getDemoDay(date, plan).items.length, 2);
  assert.equal(getDemoDay(date, plan).special.length, 0);
});
