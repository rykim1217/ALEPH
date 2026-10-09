import { dateKey, monthCells, shiftMonth, formatMinutes, daysBetween } from './calendar.js';
import { createDemoPlans, getDemoDay, studyTypes, studyColors } from './data.js';

const $ = id => document.getElementById(id);
const today = new Date();
const plans = createDemoPlans(today);
const PERSONAL_STORAGE_KEY = 'pace.personal-events.v1';
const state = { year: today.getFullYear(), month: today.getMonth(), planId: 'all', selected: dateKey(today), view: 'month' };
const fullDate = date => `${new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(date)} (${new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(date)})`;
const dateFromKey = key => { const [year, month, day] = key.split('-').map(Number); return new Date(year, month - 1, day); };

function loadPersonalEvents() {
  try {
    const stored = JSON.parse(localStorage.getItem(PERSONAL_STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter(event => event && typeof event.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.date) && typeof event.title === 'string') : [];
  } catch { return []; }
}
let personalEvents = loadPersonalEvents();
function savePersonalEvents() { localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(personalEvents)); }
function selectedPlans() { return state.planId === 'all' ? plans : plans.filter(plan => plan.id === state.planId); }
function dayFor(date) { return getDemoDay(date, selectedPlans(), personalEvents); }
function ddayFor(plan) {
  if (!plan.examDate) return '상시';
  const until = daysBetween(today, dateFromKey(plan.examDate));
  return until === 0 ? 'D-day' : until > 0 ? `D-${until}` : `D+${-until}`;
}

function itemNode(item, compact = false) {
  const element = document.createElement(compact ? 'span' : 'div');
  element.className = compact ? `event ${item.type} dot-event` : `study-row ${item.type}`;
  if (compact) { element.setAttribute('aria-label', item.title); element.title = item.title; }
  else {
    element.style.setProperty('--study-color', item.color || studyColors[item.type]);
    const badge = document.createElement('span'); badge.className = `type-badge ${item.type}`; badge.textContent = studyTypes[item.type];
    const title = document.createElement('span'); title.className = 'study-name'; title.textContent = item.title;
    const duration = document.createElement('span'); duration.className = 'duration'; duration.textContent = `${item.minutes}분`;
    element.append(badge, title, duration);
  }
  return element;
}

function renderToday() {
  const day = dayFor(today);
  $('today-date').textContent = `${new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(today)} (${new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(today)})`;
  $('today-date').dateTime = dateKey(today);
  $('today-stage').textContent = state.planId === 'all' ? `전체 일정 · 시험 ${plans.length}개` : `현재 단계 · ${state.planId === 'practical' ? '개념 학습' : '유형별 학습'}`;
  $('today-capacity').textContent = formatMinutes(day.capacity);
  $('today-total').textContent = formatMinutes(day.total);
  $('today-items').replaceChildren(...day.items.map(item => itemNode(item)));
  if (!day.items.length) $('today-items').textContent = day.rest ? '오늘은 쉬어 가는 날이에요.' : '오늘 예정된 학습이 없습니다.';
}

function renderExamOptions() {
  const options = $('exam-options');
  const choices = [{ id: 'all', name: '전체 일정', detail: `시험 ${plans.length}개` }, ...plans.map(plan => ({ id: plan.id, name: plan.name, detail: ddayFor(plan) }))];
  options.replaceChildren(...choices.map(choice => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'exam-option';
    button.setAttribute('role', 'option'); button.setAttribute('aria-selected', String(choice.id === state.planId)); button.dataset.planId = choice.id;
    const name = document.createElement('span'); name.textContent = choice.name;
    const detail = document.createElement('span'); detail.textContent = choice.detail;
    button.append(name, detail);
    button.addEventListener('click', () => choosePlan(choice.id));
    return button;
  }));
}
function renderFilter() {
  const activePlan = plans.find(plan => plan.id === state.planId);
  $('exam-select-wrap').classList.toggle('all-filter', !activePlan);
  $('exam-name').textContent = activePlan?.name || '전체 일정';
  $('exam-dday').textContent = activePlan ? ddayFor(activePlan) : `시험 ${plans.length}개`;
  renderExamOptions();
}
function setOptionsOpen(open, focusIndex = -1) {
  const trigger = $('exam-select-trigger'), options = $('exam-options');
  options.hidden = !open; trigger.setAttribute('aria-expanded', String(open));
  if (open && focusIndex >= 0) options.querySelectorAll('[role="option"]')[focusIndex]?.focus();
}
function choosePlan(id) {
  state.planId = id; setOptionsOpen(false); $('exam-select-trigger').focus();
  renderFilter(); renderToday(); renderCalendar();
  if (state.view === 'year') renderYear();
}

function renderCalendar() {
  $('month-title').textContent = `${state.year}년 ${state.month + 1}월`;
  renderFilter();
  const cells = monthCells(state.year, state.month).map(date => {
    const day = dayFor(date), isToday = day.key === dateKey(today), outside = date.getMonth() !== state.month;
    const button = document.createElement('button');
    button.className = `day-cell${outside ? ' outside' : ''}${isToday ? ' is-today' : ''}${day.key === state.selected ? ' selected' : ''}`;
    button.setAttribute('aria-label', `${date.getFullYear()}년 ${fullDate(date)}${isToday ? ', 오늘' : ''}, ${day.items.length}개 학습 일정${day.special.map(item => ', ' + item.title).join('')}${day.rest ? ', 휴식일' : ''}`);
    button.setAttribute('aria-pressed', String(day.key === state.selected));
    const heading = document.createElement('span'); heading.className = 'day-heading';
    const number = document.createElement('span'); number.className = `day-number weekday-${date.getDay()}`; number.textContent = date.getDate(); heading.append(number); button.append(heading);
    if (day.items.length) {
      const dots = document.createElement('span'); dots.className = 'day-events';
      day.items.forEach(item => { const marker = itemNode(item, true); marker.style.setProperty('--study-color', item.color || studyColors[item.type]); dots.append(marker); });
      button.append(dots);
    }
    if (day.special.length) {
      const specials = document.createElement('span'); specials.className = 'day-specials';
      const order = { goal: 0, exam: 1, personal: 2 };
      [...day.special].sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3)).forEach(item => { const marker = document.createElement('span'); marker.className = `special-event ${item.type}`; marker.textContent = item.title; specials.append(marker); });
      button.append(specials);
    }
    button.addEventListener('click', () => openDetail(date)); return button;
  });
  $('calendar').style.setProperty('--week-rows', String(cells.length / 7)); $('calendar').replaceChildren(...cells);
}

function personalManager(dateKeyValue) {
  const manager = document.createElement('section'); manager.className = 'personal-manager';
  const heading = document.createElement('h3'); heading.className = 'personal-manager-title'; heading.textContent = '개인 일정'; manager.append(heading);
  const list = document.createElement('div'); list.className = 'personal-list';
  const events = personalEvents.filter(event => event.date === dateKeyValue);
  if (!events.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = '등록된 개인 일정이 없습니다.'; list.append(empty); }
  for (const event of events) {
    const row = document.createElement('div'); row.className = 'personal-event-row';
    const label = document.createElement('span'); label.className = 'personal-event-label'; label.textContent = event.title;
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = '수정'; edit.addEventListener('click', () => { form.elements.title.value = event.title; form.dataset.editId = event.id; submit.textContent = '저장'; cancel.hidden = false; form.elements.title.focus(); });
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '삭제'; remove.addEventListener('click', () => { personalEvents = personalEvents.filter(item => item.id !== event.id); savePersonalEvents(); renderCalendar(); openDetail(dateFromKey(dateKeyValue)); });
    row.append(label, edit, remove); list.append(row);
  }
  const form = document.createElement('form'); form.className = 'personal-form';
  const input = document.createElement('input'); input.name = 'title'; input.type = 'text'; input.maxLength = 40; input.required = true; input.placeholder = '예: 병원 예약'; input.setAttribute('aria-label', '개인 일정 이름');
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = '추가';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '취소'; cancel.hidden = true;
  cancel.addEventListener('click', () => { delete form.dataset.editId; form.reset(); submit.textContent = '추가'; cancel.hidden = true; });
  form.append(input, submit, cancel);
  form.addEventListener('submit', event => {
    event.preventDefault(); const title = input.value.trim(); if (!title) return;
    const editId = form.dataset.editId;
    if (editId) personalEvents = personalEvents.map(item => item.id === editId ? { ...item, title } : item);
    else personalEvents.push({ id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, date: dateKeyValue, title });
    savePersonalEvents(); renderCalendar(); openDetail(dateFromKey(dateKeyValue));
  });
  manager.append(list, form); return manager;
}

function openDetail(date) {
  state.selected = dateKey(date); renderCalendar();
  const day = dayFor(date);
  $('detail-title').textContent = `${date.getFullYear()}년 ${fullDate(date)}`;
  const capacity = document.createElement('div'); capacity.className = 'detail-capacity';
  const capIcon = document.createElement('span'); capIcon.className = 'popup-icon'; capIcon.textContent = '◷';
  const capCopy = document.createElement('div'); capCopy.className = 'capacity-copy';
  const capLabel = document.createElement('span'); capLabel.textContent = '학습 가능시간';
  const capValue = document.createElement('strong'); capValue.textContent = formatMinutes(day.capacity); capCopy.append(capLabel, capValue);
  const capButton = document.createElement('button'); capButton.className = 'change-capacity'; capButton.textContent = '2차 예정'; capButton.disabled = true;
  capacity.append(capIcon, capCopy, capButton);
  const heading = document.createElement('h3'); heading.textContent = `예정 학습 (${day.items.length}개)`;
  const list = document.createElement('div'); list.className = 'popup-study-list'; list.append(...day.items.map(item => itemNode(item)));
  if (!day.items.length) { list.className = 'empty-state'; list.textContent = day.rest ? '휴식일입니다. 잠시 쉬어 가세요.' : '예정된 학습이 없습니다.'; }
  const specialHeading = document.createElement('h3'); specialHeading.className = 'special-heading';
  const specialIcon = document.createElement('span'); specialIcon.textContent = '⚑'; specialHeading.append(specialIcon, document.createTextNode(' 특별 일정'));
  const specials = document.createElement('div'); specials.className = 'special-events';
  day.special.filter(item => item.type !== 'personal').forEach(item => { const event = document.createElement('span'); event.className = `special-event ${item.type}`; event.textContent = item.title; specials.append(event); });
  if (day.rest) { const event = document.createElement('span'); event.className = 'special-event rest'; event.textContent = '휴식일'; specials.append(event); }
  if (!specials.childElementCount) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = '등록된 시험·목표 일정이 없습니다.'; specials.append(empty); }
  const changeDay = document.createElement('button'); changeDay.type = 'button'; changeDay.className = 'change-day'; changeDay.disabled = true;
  const changeLabel = document.createElement('span'); changeLabel.textContent = '이 날만 학습시간 변경';
  const changeStatus = document.createElement('span'); changeStatus.textContent = '2차 개발 예정'; changeDay.append(changeLabel, changeStatus);
  $('detail-content').replaceChildren(capacity, heading, list, specialHeading, specials, personalManager(day.key), changeDay);
  $('detail-notice').textContent = '예시 학습 일정은 편집할 수 없습니다. 개인 일정은 이 화면에서 저장·수정할 수 있습니다.';
  const dialog = $('date-dialog'), selectedCell = document.querySelector('.day-cell.selected'), cellRect = selectedCell?.getBoundingClientRect();
  if (!dialog.open) dialog.showModal();
  const dialogRect = dialog.getBoundingClientRect();
  const popupX = Math.min(Math.max(16, (cellRect?.left ?? innerWidth * .35) + 105), Math.max(16, innerWidth - dialogRect.width - 16));
  const popupY = Math.min(Math.max(16, (cellRect?.top ?? innerHeight * .3) + 70), Math.max(16, innerHeight - dialogRect.height - 16));
  dialog.style.setProperty('--popup-x', `${popupX}px`); dialog.style.setProperty('--popup-y', `${popupY}px`);
}

function renderYear() {
  $('year-title').textContent = `${state.year}년`;
  const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const cards = Array.from({ length: 12 }, (_, month) => {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'year-month';
    const title = document.createElement('strong'); title.textContent = `${month + 1}월`;
    const weekdays = document.createElement('span'); weekdays.className = 'year-weekdays';
    weekdayNames.forEach((name, index) => { const dayName = document.createElement('span'); dayName.textContent = name; if (index === 0) dayName.classList.add('sunday'); weekdays.append(dayName); });
    const days = document.createElement('span'); days.className = 'year-days';
    monthCells(state.year, month).forEach(date => {
      const cell = document.createElement('span'); cell.className = `year-day${date.getMonth() !== month ? ' outside' : ''}`;
      if (date.getMonth() === month) {
        const number = document.createElement('span'); number.textContent = date.getDate(); cell.append(number);
        const summary = dayFor(date), types = new Set(summary.special.map(event => event.type));
        summary.items.forEach(item => types.add(item.type));
        const markers = document.createElement('span'); markers.className = 'year-markers';
        [...types].slice(0, 4).forEach(type => { const dot = document.createElement('i'); dot.className = type; markers.append(dot); });
        cell.append(markers);
      }
      days.append(cell);
    });
    card.append(title, weekdays, days);
    card.setAttribute('aria-label', `${state.year}년 ${month + 1}월 월간 달력 보기`);
    card.addEventListener('click', () => { state.month = month; state.view = 'month'; if (!state.selected.startsWith(`${state.year}-${String(month + 1).padStart(2, '0')}-`)) state.selected = dateKey(new Date(state.year, month, 1)); showView(); renderCalendar(); });
    return card;
  });
  $('year-grid').replaceChildren(...cards);
}
function showView() {
  if (state.view === 'year') { renderYear(); if (!$('year-dialog').open) $('year-dialog').showModal(); }
  else if ($('year-dialog').open) $('year-dialog').close();
}
function goToToday() { Object.assign(state, { year: today.getFullYear(), month: today.getMonth(), selected: dateKey(today), view: 'month' }); showView(); renderCalendar(); }

let toastTimer;
function notify(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 4000); }
for (const [id, offset] of [['previous-month', -1], ['next-month', 1]]) $(id).addEventListener('click', () => { Object.assign(state, shiftMonth(state.year, state.month, offset)); renderCalendar(); });
$('go-today-side').addEventListener('click', goToToday); $('schedule-nav').addEventListener('click', goToToday); $('today-detail').addEventListener('click', () => openDetail(today));
$('exam-select-trigger').addEventListener('click', () => setOptionsOpen($('exam-options').hidden));
$('exam-select-trigger').addEventListener('keydown', event => {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); setOptionsOpen(true, event.key === 'ArrowUp' ? plans.length : 0); }
});
$('exam-options').addEventListener('keydown', event => {
  const buttons = [...$('exam-options').querySelectorAll('[role="option"]')], index = buttons.indexOf(document.activeElement);
  if (event.key === 'Escape') { event.preventDefault(); setOptionsOpen(false); $('exam-select-trigger').focus(); }
  else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
  else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); buttons[event.key === 'Home' ? 0 : buttons.length - 1]?.focus(); }
});
document.addEventListener('pointerdown', event => { if (!$('exam-select-wrap').contains(event.target)) setOptionsOpen(false); });
for (const [id, offset] of [['previous-year', -1], ['next-year', 1]]) $(id).addEventListener('click', () => { state.year += offset; renderYear(); });
$('year-view-toggle').addEventListener('click', () => { state.view = 'year'; showView(); }); $('year-today').addEventListener('click', goToToday);
$('close-year').addEventListener('click', () => $('year-dialog').close());
$('year-dialog').addEventListener('close', () => { state.view = 'month'; });
$('year-dialog').addEventListener('click', event => { if (event.target === $('year-dialog')) $('year-dialog').close(); });
$('close-dialog').addEventListener('click', () => $('date-dialog').close());
$('date-dialog').addEventListener('click', event => { const rect = $('date-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('date-dialog').close(); });
document.querySelectorAll('[data-future]').forEach(button => button.addEventListener('click', () => notify(`${button.dataset.future} 기능은 후속 단계에서 구현합니다. 현재는 예시 일정을 확인할 수 있습니다.`)));
renderToday(); renderCalendar();
