import { dateKey } from './calendar.js';
export const studyTypes = { lecture: '강의', practice: '문제풀이', review: '복습' };
export const studyColors = { lecture: '#A089F1', practice: '#5D8CF7', review: '#66A98D' };

// Accept explicit records from future learning/availability features; never invent assignments.
export function getDaySummary(date, plansOrPlan, personalEvents = [], { studyItems = [], availability = {}, goals = [] } = {}) {
  const plans = Array.isArray(plansOrPlan) ? plansOrPlan : plansOrPlan ? [plansOrPlan] : [];
  const key = dateKey(date), planIds = new Set(plans.map(plan => plan.id));
  const special = plans.filter(plan => plan.examDate && plan.examDate === key).map(plan => ({ type: 'exam', title: plan.examLabel || `${plan.name} 시험`, planId: plan.id, color: plan.color }));
  special.push(...goals.filter(goal => goal.date === key && planIds.has(goal.planId) && goal.source !== 'demo').map(goal => ({ ...goal, type: 'goal' })));
  special.push(...personalEvents.filter(event => event.date === key).map(event => ({ ...event, type: 'personal' })));
  const items = studyItems.filter(item => item.date === key && planIds.has(item.planId) && item.source !== 'demo' && Number.isFinite(item.minutes) && item.minutes >= 0);
  const configured = availability[key];
  const capacity = Number.isFinite(configured) && configured >= 0 ? configured : null;
  return { key, capacity, items, special, rest: false, total: items.length ? items.reduce((sum, item) => sum + item.minutes, 0) : null };
}
