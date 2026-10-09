import { dateKey } from './calendar.js';

export const studyTypes = { lecture: '강의', practice: '문제풀이', review: '복습' };
// 학습 유형별 색상은 사이드바, 캘린더, 날짜 상세에서 함께 사용합니다.
export const studyColors = { lecture: '#A089F1', practice: '#5D8CF7', review: '#66A98D' };

function monthlyRestDates(year, month) {
  const sundays = [];
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === 0) sundays.push(dateKey(date));
  }
  return [sundays[1], sundays[3]].filter(Boolean);
}

// 이 데이터는 화면 확인을 위한 정적 예시입니다. 자동 배분 결과가 아닙니다.
export function createDemoPlans(today) {
  const year = today.getFullYear(), month = today.getMonth();
  const restDates = [...monthlyRestDates(year, month), ...monthlyRestDates(year, month + 1)];
  return [
    { id: 'practical', name: '정보처리기사 실기', examDate: '2026-10-25', examLabel: '실기 시험', goalDate: '2026-10-16', goalName: '이론 완료 목표', subjects: ['데이터베이스 7강', 'SQL 8강', '프로그래밍 4강'], restDates },
    { id: 'language', name: '영어 능력 시험', examDate: dateKey(new Date(year, month + 1, 21)), goalDate: dateKey(new Date(year, month, 26)), goalName: '어휘 학습 목표', subjects: ['독해 유형 강의', '실전 문제풀이', '핵심 어휘 복습'], restDates },
  ];
}

const weeklyItems = {
  0: ['review'], 1: ['lecture', 'review'], 2: ['lecture', 'practice'],
  3: ['practice'], 4: ['lecture', 'review'], 5: ['lecture', 'practice', 'review'], 6: ['practice'],
};
const durations = { lecture: 48, practice: 42, review: 35 };

// Reuse this plan-specific boundary for generated examples and future auto-allocation.
export function canSchedulePlanStudy(date, plan) {
  return !plan.examDate || dateKey(date) < plan.examDate;
}

export function getDemoDay(date, plansOrPlan, personalEvents = []) {
  const plans = Array.isArray(plansOrPlan) ? plansOrPlan : plansOrPlan ? [plansOrPlan] : [];
  const key = dateKey(date), weekday = date.getDay();
  const special = plans.flatMap(plan => [
    ...(key === plan.goalDate ? [{ type: 'goal', title: plan.goalName, planId: plan.id }] : []),
    ...(plan.examDate && key === plan.examDate ? [{ type: 'exam', title: plan.examLabel || `${plan.name} 시험`, planId: plan.id }] : []),
  ]);
  special.push(...personalEvents.filter(event => event.date === key).map(event => ({ ...event, type: 'personal' })));
  const rest = plans.some(plan => (plan.restDates || []).includes(key));
  const isExamDay = plans.some(plan => key === plan.examDate);
  // Available time belongs to the day, not to each plan; never sum it per exam.
  const capacity = rest || isExamDay ? 0 : weekday === 6 ? 240 : weekday === 0 ? 60 : 145;
  const items = rest ? [] : plans.filter(plan => canSchedulePlanStudy(date, plan)).flatMap(plan =>
    weeklyItems[weekday].map(type => ({
      id: `${plan.id}-${key}-${type}`, planId: plan.id, type,
      title: plan.subjects[type === 'lecture' ? 0 : type === 'practice' ? 1 : 2],
      minutes: durations[type], color: studyColors[type],
    })));
  return { key, capacity, items, special, rest, total: items.reduce((sum, item) => sum + item.minutes, 0) };
}
