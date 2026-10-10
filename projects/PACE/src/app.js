import {initBackupImport} from './backup-import.js';
import {pruneExamPrepSettings} from './distribution-settings.js';
import {studyDisplayName,studyFullTitle,initStudyTooltips} from './study-display.js';
import {initStudyPlanning} from './study-planning.js';
import { initStudyManager } from './study-manager.js';
import { STUDY_KEY, emptyStudy, loadStudy, migrateSavedStudy, studyItems, lectureItems, setLectureCompleted, categoryDots } from './study.js';
import { initAvailabilityUI, aggregateAvailabilityText, resolveAvailability } from './availability.js';
import { dateKey, monthCells, shiftMonth, formatMinutes, daysBetween, detailPlacement, attachedEditorPlacement, datePickerPlacement } from './calendar.js';
import { getDaySummary, studyTypes, studyColors } from './data.js';
import { loadCertifications, saveCertifications, upsertCertification, deleteCertification, DEFAULT_CERTIFICATION_COLOR, validateGoal, updateCertificationDetails, milestoneCategories, resolvedMilestoneCategories, configureMilestone,certificationChoiceEntries,populateCertificationSelect,defaultCertificationId } from './certifications.js';

const $ = id => document.getElementById(id);
const today = new Date();
let plans;
let certificationLoadError = false;
try { plans = loadCertifications(localStorage, []); }
catch { plans = []; certificationLoadError = true; }
let studyData=emptyStudy(),studyLoadError=false;
try { studyData=migrateSavedStudy(localStorage); } catch { studyLoadError=true; }
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
function dayFor(date) { const day = getDaySummary(date, selectedPlans(), personalEvents, { studyItems: studyItems(studyData), goals: plans.flatMap(plan => (plan.goals || []).map(goal => ({ ...goal, planId: plan.id }))) }); const resolved = availabilitySettings.resolve(date); return { ...day, items: lectureItems(studyData).filter(item=>item.date===dateKey(date)&&selectedPlans().some(plan=>plan.id===item.planId)), capacity: resolved.minutes, rest: resolved.rest }; }
function ddayFor(plan) {
  if (!plan.examDate) return '';
  const until = daysBetween(today, dateFromKey(plan.examDate));
  return until === 0 ? 'D-day' : until > 0 ? `D-${until}` : `D+${-until}`;
}

function itemNode(item, compact = false) {
  const displayTitle=item.recordId?studyDisplayName(item):item.title;
  const element = document.createElement(compact ? 'span' : 'div');
  element.className = compact ? `event ${item.type} dot-event` : `study-row ${item.type}`;
  if (compact) { element.setAttribute('aria-label', displayTitle); element.title = studyFullTitle(item); }
  else {
    element.style.setProperty('--study-color', item.color || studyColors[item.type]);
    const badge = document.createElement('span'); badge.className = `type-badge ${item.type}`; badge.textContent = studyTypes[item.type];
    const title = document.createElement('span'); title.className = 'study-name'; title.textContent = displayTitle; title.dataset.studyFullTitle=studyFullTitle(item);
    const duration = document.createElement('span'); duration.className = 'duration'; duration.textContent = `${item.minutes}분`;
    if(item.recordId){
      const dot=document.createElement('span');dot.className='lecture-category-dot';dot.style.backgroundColor=categoryColor(item.planId,item.category);dot.title=({theory:'이론',programming:'프로그래밍',sql:'SQL'})[item.category]||item.category;
      const check=document.createElement('input');check.type='checkbox';check.checked=item.completed;check.setAttribute('aria-label',`${item.date||''} ${item.title} 완료`);check.disabled=studyLoadError;check.onchange=()=>{try{const next=setLectureCompleted(studyData,item.id,check.checked);localStorage.setItem(STUDY_KEY,JSON.stringify(next));studyData=next;renderToday();renderCalendar();if(state.view==='year')renderYear();if($('date-dialog').open)openDetail(dateFromKey(state.selected));if(state.view==='study')studyManager.render();if(state.view==='planning')planningPage.render();}catch{check.checked=!check.checked;notify('학습 기록을 저장하지 못했습니다.');}};
      element.classList.add('lecture-item-row');element.append(dot,title,check);
    }else element.append(badge, title, duration);
  }
  return element;
}

function renderToday() {
  const day = dayFor(today);
  $('today-date').textContent = `${new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(today)} (${new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(today)})`;
  $('today-date').dateTime = dateKey(today);
  const capacityText=aggregateAvailabilityText(availabilitySettings.aggregate(today));
  $('today-capacity').classList.toggle('choose-target',capacityText.length>10);
  $('today-capacity').textContent = capacityText;
  $('today-total').textContent = day.total === null ? '—' : formatMinutes(day.total);
  $('today-items').replaceChildren(...day.items.map(item => itemNode(item)));
  if (!day.items.length) $('today-items').textContent = '아직 배정된 학습 항목이 없습니다.';
}

function renderExamOptions() {
  const options = $('exam-options');
  const choices = [{ id: 'all', name: '전체 일정', detail: `시험 ${plans.length}개` }, ...certificationChoiceEntries(plans).map(entry=>entry.separator?entry:({id:entry.plan.id,name:entry.plan.name,detail:ddayFor(entry.plan),color:entry.plan.color||DEFAULT_CERTIFICATION_COLOR}))];
  options.replaceChildren(...choices.map(choice => {
    if(choice.separator){const separator=document.createElement('div');separator.className='exam-option-separator';separator.setAttribute('role','separator');separator.textContent='지난 시험';return separator;}
    const button = document.createElement('button'); button.type = 'button'; button.className = 'exam-option';
    button.setAttribute('role', 'option'); button.setAttribute('aria-selected', String(choice.id === state.planId)); button.dataset.planId = choice.id;
    const name = document.createElement('span'); name.textContent = choice.name;
    if (choice.color) { name.className = 'certification-name'; name.style.setProperty('--certification-color', choice.color); }
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
  $('exam-name').classList.toggle('certification-name', !!activePlan);
  $('exam-name').style.setProperty('--certification-color', activePlan?.color || DEFAULT_CERTIFICATION_COLOR);
  $('exam-dday').textContent = activePlan ? ddayFor(activePlan) : `시험 ${plans.length}개`;
  $('exam-dday').hidden = !!activePlan && !activePlan.examDate;
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
    const number = document.createElement('span'); number.className = `day-number weekday-${date.getDay()}`; number.textContent = date.getDate();
    const dateLabel = document.createElement('span'); dateLabel.className = 'day-date-label'; dateLabel.append(number);
    if (isToday) { const label = document.createElement('span'); label.className = 'today-label'; label.textContent = '오늘'; dateLabel.append(label); }
    heading.append(dateLabel); button.append(heading);
    if (day.items.length) {
      const dots = document.createElement('span'); dots.className = 'day-events';
      categoryDots(day.items).forEach(item => { const marker = itemNode(item, true); marker.classList.add('calendar-study-dot'); marker.style.backgroundColor=categoryColor(item.planId,item.category); marker.title=({theory:'이론',programming:'프로그래밍',sql:'SQL'})[item.category]||item.category; dots.append(marker); });
      button.append(dots);
    }
    if (day.rest) { const label = document.createElement('span'); label.className = 'special-event rest'; label.textContent = '휴식일'; heading.append(label); }
    if (day.special.length) {
      const examDots = document.createElement('span'); examDots.className = 'day-events certification-dots';
      day.special.filter(item => item.type === 'exam').forEach(item => { const dot = document.createElement('span'); dot.className = 'event dot-event calendar-exam-dot'; dot.style.backgroundColor = item.color || DEFAULT_CERTIFICATION_COLOR; dot.title = plans.find(plan => plan.id === item.planId)?.name || item.title; dot.setAttribute('aria-label', dot.title); examDots.append(dot); });
      if (examDots.childElementCount) {const dots=button.querySelector('.day-events');if(dots)dots.prepend(...examDots.children);else button.append(examDots);}
      const specials = document.createElement('span'); specials.className = 'day-specials';
      const order = { goal: 0, exam: 1, personal: 2 };
      [...day.special].sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3)).forEach(item => { const marker = specialNode(item); specials.append(marker); });
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

function positionDetail() {
  const dialog=$('date-dialog');if(!dialog.open)return;
  dialog.classList.remove('detail-fullscreen');
  const selected=document.querySelector('.day-cell.selected'),cell=state.view==='study'?null:selected?.getBoundingClientRect();
  if(!cell||!cell.width||!cell.height){const rect=dialog.getBoundingClientRect();dialog.classList.toggle('detail-fullscreen',innerWidth<600||rect.height>innerHeight-24);const trigger=$('today-detail').getBoundingClientRect(),card=$('today-detail').closest('.today-card')?.getBoundingClientRect();const x=state.view==='study'?Math.min(innerWidth-rect.width-12,(card?.right||trigger.right)+10):(innerWidth-rect.width)/2;const y=state.view==='study'?Math.min(innerHeight-rect.height-12,trigger.top-18):(innerHeight-rect.height)/2;dialog.style.setProperty('--popup-x',Math.max(12,x)+'px');dialog.style.setProperty('--popup-y',Math.max(12,y)+'px');return;}
  const rect=dialog.getBoundingClientRect(),position=detailPlacement(cell,rect.width,rect.height,innerWidth,innerHeight);
  dialog.classList.toggle('detail-fullscreen',!!position.fullscreen);
  if(!position.fullscreen){dialog.style.setProperty('--popup-x',position.x+'px');dialog.style.setProperty('--popup-y',position.y+'px');}
}
window.addEventListener('resize',()=>{positionDetail();positionTimeEditor();alignSidebarTimeButton();});

function closeTimeEditor(){document.querySelector('#attached-time-editor')?.remove();const button=document.querySelector('.detail-capacity .change-capacity');if(button){button.style.visibility='';button.setAttribute('aria-expanded','false');}}
function positionTimeEditor(){const editor=document.querySelector('#attached-time-editor');if(!editor)return;editor.classList.remove('editor-fullscreen');const anchor=document.querySelector('.day-cell.selected'),cell=state.view==='study'?{left:-1,right:-1,top:-1,bottom:-1,width:0,height:0}:anchor?.getBoundingClientRect()||{left:-1,right:-1,top:-1,bottom:-1,width:0,height:0},detail=$('date-dialog').getBoundingClientRect(),rect=editor.getBoundingClientRect();const p=attachedEditorPlacement(detail,cell,rect.width,rect.height,innerWidth,innerHeight);editor.classList.toggle('editor-fullscreen',!!p.fullscreen);if(!p.fullscreen){editor.style.left=p.x+'px';editor.style.top=p.y+'px';}}
function openTimeEditor(date){closeTimeEditor();const panel=document.createElement('section');panel.id='attached-time-editor';panel.setAttribute('aria-label','날짜별 학습시간 변경');const title=document.createElement('h3');title.textContent='학습 가능시간 변경';panel.append(title,dateTimeEditor(date));$('date-dialog').append(panel);const button=document.querySelector('.detail-capacity .change-capacity');button.style.visibility='hidden';button.setAttribute('aria-expanded','true');positionTimeEditor();}
function alignSidebarTimeButton(){const button=$('edit-today-time'),todayButton=$('go-today-side');button.style.transform='none';const a=todayButton.getBoundingClientRect(),b=button.getBoundingClientRect();button.style.width=a.width+'px';button.style.height=a.height+'px';button.style.borderRadius=getComputedStyle(todayButton).borderRadius;button.style.transform='translateX('+(a.right-button.getBoundingClientRect().right)+'px)';}
function dateTimeEditor(date) {
  const form=document.createElement('form');form.className='date-time-editor';form.setAttribute('aria-label','이 날짜 학습시간 편집');
  const target=document.createElement('select');target.setAttribute('aria-label','학습 대상');
  populateCertificationSelect(target,plans,state.planId);
  const kind=document.createElement('select');kind.setAttribute('aria-label','해당 날짜 상태');for(const [value,text] of [['study','공부 가능'],['rest','휴식']]){const option=document.createElement('option');option.value=value;option.textContent=text;kind.append(option);}
  const hour=document.createElement('input'),minute=document.createElement('input');for(const input of [hour,minute]){input.type='number';input.min='0';input.step='1';}hour.max='24';minute.max='59';hour.setAttribute('aria-label','공부 가능 시간 시간');minute.setAttribute('aria-label','공부 가능 시간 분');
  const labelRow=(text,input)=>{const label=document.createElement('label');label.textContent=text;label.append(input);return label;};
  const time=document.createElement('div');time.className='inline-time-inputs';time.append(hour,document.createTextNode('시간'),minute,document.createTextNode('분'));
  const status=document.createElement('p');status.className='inline-time-status';status.setAttribute('role','status');
  const actions=document.createElement('div');actions.className='certification-actions';
  const remove=document.createElement('button');remove.type='button';remove.textContent='예외 삭제';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>closeTimeEditor();
  const apply=document.createElement('button');apply.type='submit';apply.textContent='적용';actions.append(remove,cancel,apply);
  const updateDisabled=()=>{hour.disabled=minute.disabled=kind.value==='rest'||apply.disabled;};
  const load=()=>{const rule=availabilitySettings.rule(target.value),key=dateKey(date),outside=rule&&(key<rule.startDate||(rule.endDate&&key>rule.endDate));
    const exception=rule?.exceptions[key],resolved=rule?resolveAvailability(date,rule):{minutes:null,rest:false};
    kind.value=exception?.kind||(resolved.rest?'rest':'study');const minutes=exception?.minutes??resolved.minutes;hour.value=minutes===null?'':Math.floor(minutes/60);minute.value=minutes===null?'':minutes%60;
    apply.disabled=!rule||!!outside;kind.disabled=apply.disabled;remove.hidden=!exception;remove.disabled=apply.disabled;
    status.textContent=!plans.length?'먼저 자격증을 등록해 주세요.':!rule?'학습 가능시간 설정에서 학습 시작일을 먼저 설정해 주세요.':outside?'이 날짜는 선택한 자격증의 학습 기간 밖입니다.':'이 날짜에만 적용됩니다.';updateDisabled();};
  target.onchange=()=>{load();positionTimeEditor();};kind.onchange=updateDisabled;
  remove.onclick=()=>{try{availabilitySettings.updateException(target.value,dateKey(date),null);}catch(error){status.textContent=error.message;positionTimeEditor();}};
  form.onsubmit=event=>{event.preventDefault();try{if(apply.disabled)return;if(kind.value==='study'&&hour.value===''&&minute.value==='')throw Error('공부 가능한 시간을 입력해 주세요.');availabilitySettings.updateException(target.value,dateKey(date),{kind:kind.value,minutes:kind.value==='rest'?0:Number(hour.value||0)*60+Number(minute.value||0)});}catch(error){status.textContent=error.message;positionTimeEditor();}};
  form.append(labelRow('학습 대상',target),labelRow('해당 날짜 상태',kind),labelRow('공부 가능시간',time),status,actions);load();return form;
}

function openDetail(date,editing=false) {
  const preservePosition=$('date-dialog').open&&state.selected===dateKey(date);
  closeTimeEditor();
  state.selected = dateKey(date); renderCalendar();
  const day = dayFor(date);
  $('detail-title').textContent = `${date.getFullYear()}년 ${fullDate(date)}`;
  const capacity = document.createElement('div'); capacity.className = 'detail-capacity';
  const capIcon = document.createElement('span'); capIcon.className = 'popup-icon'; capIcon.textContent = '◷';
  const capCopy = document.createElement('div'); capCopy.className = 'capacity-copy';
  const capLabel = document.createElement('span'); capLabel.textContent = '학습 가능시간';
  const capValue = document.createElement('strong'); capValue.textContent = aggregateAvailabilityText(availabilitySettings.aggregate(date)); capCopy.append(capLabel, capValue);
  const change=document.createElement('button');change.type='button';change.className='change-capacity';change.textContent='변경';change.setAttribute('aria-expanded',String(editing));change.onclick=()=>openTimeEditor(date);
  capacity.append(capIcon, capCopy,change);
  const heading = document.createElement('h3'); heading.textContent = `학습 항목 (${day.items.length}개)`;
  const list = document.createElement('div'); list.className = 'popup-study-list'; for(const record of studyItems(studyData).filter(r=>r.date===day.key&&selectedPlans().some(p=>p.id===r.planId)))list.append(studyDayMeta(record)); list.append(...day.items.map(item => itemNode(item)));
  if (!day.items.length) { list.className = 'empty-state'; list.textContent = '아직 배정된 학습 항목이 없습니다.'; }
  const specialHeading = document.createElement('h3'); specialHeading.className = 'special-heading';
  const specialIcon = document.createElement('span'); specialIcon.textContent = '⚑'; specialHeading.append(specialIcon, document.createTextNode(' 특별 일정'));
  const specials = document.createElement('div'); specials.className = 'special-events';
  day.special.filter(item => item.type !== 'personal').forEach(item => specials.append(specialNode(item)));
  if (day.rest) { const event = document.createElement('span'); event.className = 'special-event rest'; event.textContent = '휴식일'; specials.append(event); }
  if (!specials.childElementCount) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = '등록된 시험·목표 일정이 없습니다.'; specials.append(empty); }
  $('detail-content').replaceChildren(capacity, heading, list, specialHeading, specials, personalManager(day.key));

  $('detail-notice').textContent = '개인 일정은 이 화면에서 추가·수정할 수 있습니다.';
  const dialog = $('date-dialog');
  if (!dialog.open) dialog.showModal();
  if(!preservePosition)positionDetail();
  if(editing)openTimeEditor(date);
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

        const markers = document.createElement('span'); markers.className = 'year-markers';
        summary.special.filter(item => item.type === 'exam').forEach(item => { const dot = document.createElement('i'); dot.className = 'exam'; dot.style.backgroundColor = item.color || DEFAULT_CERTIFICATION_COLOR; dot.title = item.title; markers.append(dot); });
        [...types].filter(type => type !== 'exam').slice(0, 4).forEach(type => { const dot = document.createElement('i'); dot.className = type; markers.append(dot); });
        categoryDots(summary.items).forEach(item=>{const dot=document.createElement('i');dot.style.backgroundColor=categoryColor(item.planId,item.category);markers.append(dot);});
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
  $('month-view').hidden=['study','planning'].includes(state.view);studyRoot.hidden=state.view!=='study';planningRoot.hidden=state.view!=='planning';syncSidebarSelection();
  if (state.view === 'year') { renderYear(); if (!$('year-dialog').open) $('year-dialog').showModal(); }
  else if ($('year-dialog').open) $('year-dialog').close();
}
function goToToday() { Object.assign(state, { year: today.getFullYear(), month: today.getMonth(), selected: dateKey(today), view: 'month' }); showView(); renderCalendar(); }

initBackupImport({openButton:$('backup-import-settings'),storage:localStorage});
let toastTimer;
function notify(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 4000); }
for (const [id, offset] of [['previous-month', -1], ['next-month', 1]]) $(id).addEventListener('click', () => { Object.assign(state, shiftMonth(state.year, state.month, offset)); renderCalendar(); });
$('go-today-side').addEventListener('click', goToToday); $('schedule-nav').addEventListener('click', goToToday); $('today-detail').addEventListener('click', goToToday);
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
$('date-dialog').addEventListener('close',closeTimeEditor);
$('close-dialog').addEventListener('click', () => $('date-dialog').close());
$('date-dialog').addEventListener('click', event => { if(event.target.closest('#attached-time-editor'))return; const rect = $('date-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('date-dialog').close(); });
function categoryColor(planId,category){return studyData.categoryColors?.[planId]?.[category]||({theory:studyColors.lecture,programming:studyColors.practice,sql:studyColors.review})[category]||studyColors.lecture;}
function studyDayMeta(record){const meta=document.createElement('p');meta.className='study-day-meta';meta.textContent=`원본 ${formatMinutes(record.originalMinutes)} · ${studyData.speeds[record.planId]||1.5}배속 · 예상 ${formatMinutes(record.minutes)} · ${record.sourceStatus}`;return meta;}
const studyRoot=document.createElement('section');studyRoot.id='study-management';studyRoot.hidden=true;document.querySelector('main').append(studyRoot);
const studyManager=initStudyManager({root:studyRoot,getPlans:()=>plans,getData:()=>studyData,itemNode,colorFor:categoryColor,save:next=>{if(studyLoadError)throw new Error('학습 저장 데이터를 확인해 주세요.');localStorage.setItem(STUDY_KEY,JSON.stringify(next));studyData=next;try{pruneExamPrepSettings(localStorage,next);}catch{}renderToday();renderCalendar();if($('date-dialog').open)openDetail(dateFromKey(state.selected));studyManager.render();if(state.view==='planning')planningPage.render();}});
const planningRoot=document.createElement('section');planningRoot.id='study-planning';planningRoot.hidden=true;document.querySelector('main').append(planningRoot);
const planningPage=initStudyPlanning({root:planningRoot,getPlans:()=>plans,getData:()=>studyData,colorFor:categoryColor,storage:localStorage,today,save:next=>{if(studyLoadError)throw Error('학습 저장 데이터를 확인해 주세요.');localStorage.setItem(STUDY_KEY,JSON.stringify(next));studyData=next;renderToday();renderCalendar();if($('date-dialog').open)openDetail(dateFromKey(state.selected));},openDate:(date,id)=>{state.planId=id;state.selected=dateKey(date);openDetail(date);},openAvailability:id=>{state.planId=id;$('availability-settings').click();}});
$('planning-nav').onclick=()=>{state.view='planning';planningPage.render();showView();};
$('study-settings').onclick=()=>{state.view='study';studyManager.render();showView();};
document.querySelectorAll('[data-future]').forEach(button => button.addEventListener('click', () => notify(`${button.dataset.future} 기능은 후속 단계에서 구현합니다. 현재는 예시 일정을 확인할 수 있습니다.`)));
function specialNode(item) {
  const node = document.createElement('span'); node.className = `special-event ${item.type}`; node.textContent = item.title;
  return node;
}

const certificationForm = $('certification-form');
let activeCertificationPicker = null;
function closeDatePicker() {
  if (activeCertificationPicker) {
    activeCertificationPicker.picker.hidePopover(); activeCertificationPicker.picker.remove();
    activeCertificationPicker.trigger.setAttribute('aria-expanded', 'false'); activeCertificationPicker = null;
  }
}
function positionCertificationPicker() {
  if (!activeCertificationPicker) return;
  const {picker,trigger}=activeCertificationPicker;
  const bounds=$('certification-dialog').getBoundingClientRect(), anchor=trigger.getBoundingClientRect();
  const width=Math.min(300,bounds.width-24,window.innerWidth-24);
  picker.style.width=width+'px';
  const height=picker.getBoundingClientRect().height;
  const position=datePickerPlacement(anchor,bounds,width,height,window.innerWidth,window.innerHeight);
  picker.style.left=position.x+'px';picker.style.top=position.y+'px';
}
function updateExamDate() { addExam.refresh(); closeDatePicker(); }
document.addEventListener('pointerdown',event=>{if(activeCertificationPicker&&!activeCertificationPicker.picker.contains(event.target)&&!activeCertificationPicker.trigger.contains(event.target))closeDatePicker();});
$('certification-dialog').addEventListener('keydown',event=>{if(event.key==='Escape'&&activeCertificationPicker){event.preventDefault();event.stopPropagation();const trigger=activeCertificationPicker.trigger;closeDatePicker();trigger.focus();}});
$('certification-dialog').addEventListener('close',closeDatePicker);
$('certification-dialog').addEventListener('scroll',positionCertificationPicker);
window.addEventListener('resize',positionCertificationPicker);
function resetCertificationForm() {
  certificationForm.reset(); certificationForm.elements.examDate.value = ''; updateExamDate();
  certificationForm.hidden = editingCertification !== null;
  $('save-certification').textContent = '추가';
  $('certification-error').hidden = true;
}
function commitCertifications(next) {
  if (certificationLoadError) { $('certification-error').textContent = '기존 자격증을 불러오지 못해 덮어쓰기를 중단했습니다. 브라우저 설정을 확인해 주세요.'; $('certification-error').hidden = false; return false; }
  try { saveCertifications(localStorage, next); }
  catch { $('certification-error').textContent = '저장하지 못했습니다. 브라우저 저장 공간과 설정을 확인해 주세요.'; $('certification-error').hidden = false; return false; }
  plans = next;
  if (!plans.some(plan => plan.id === state.planId)) state.planId = 'all';
  renderToday(); renderCalendar(); if (state.view === 'year') renderYear(); if(state.view==='planning')planningPage.render();
  if ($('date-dialog').open) openDetail(dateFromKey(state.selected));
  editingCertification = null; resetCertificationForm(); renderCertifications(); return true;
}
let editingCertification = null;
function editDateField(value, label, optional = false) {
  const field = document.createElement('div'); field.className = 'exam-date-field';
  const title = document.createElement('div'); title.className = 'exam-date-title'; title.textContent = label;
  if (optional) { const note = document.createElement('span'); note.className = 'optional'; note.textContent = '선택 사항'; title.append(note); }
  const input = document.createElement('input'); input.type = 'hidden'; input.value = value || '';
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'exam-date-trigger'; trigger.setAttribute('aria-expanded', 'false');
  const caption = document.createElement('span'); const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.innerHTML='<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>';trigger.append(caption,icon);
  const picker = document.createElement('section'); picker.className = 'exam-date-picker certification-floating-picker'; picker.setAttribute('popover','manual');picker.setAttribute('aria-label',label+' 선택');
  let shown = value ? dateFromKey(value) : today;
  const close = () => { if(activeCertificationPicker?.picker===picker)closeDatePicker(); };
  const refresh=()=>{caption.textContent=input.value?input.value.replaceAll('-','.') : label+' 선택';};
  const choose = date => { input.value = date ? dateKey(date) : ''; input.dispatchEvent(new Event('change')); refresh(); close(); };
  const render = () => {
    picker.replaceChildren(); const head = document.createElement('div'); head.className = 'date-picker-header';
    const title = document.createElement('strong'); title.textContent = `${shown.getFullYear()}년 ${shown.getMonth() + 1}월`;
    const nav = offset => { const b = document.createElement('button'); b.type = 'button'; b.textContent = offset < 0 ? '‹' : '›'; b.setAttribute('aria-label', offset < 0 ? '이전 달' : '다음 달'); b.onclick = () => { const next = shiftMonth(shown.getFullYear(), shown.getMonth(), offset); if (next.year < 1 || next.year > 9999) return; shown = new Date(next.year, next.month, 1); render(); positionCertificationPicker(); }; return b; };
    head.append(nav(-1), title, nav(1));
    const weekdays=document.createElement('div');weekdays.className='date-picker-weekdays';weekdays.setAttribute('aria-hidden','true');for(const text of ['일','월','화','수','목','금','토']){const span=document.createElement('span');span.textContent=text;weekdays.append(span);}
    const days = document.createElement('div'); days.className = 'date-picker-days';
    for (const date of monthCells(shown.getFullYear(), shown.getMonth())) { const b = document.createElement('button'); b.type = 'button'; b.className = 'picker-day' + (date.getMonth() !== shown.getMonth() ? ' outside' : '') + (dateKey(date) === dateKey(today) ? ' today' : ''); b.textContent = date.getDate(); b.setAttribute('aria-label', `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`); b.setAttribute('aria-pressed', String(dateKey(date) === input.value)); b.onclick = () => choose(date); days.append(b); }
    const footer = document.createElement('div'); footer.className = 'date-picker-footer';
    for (const [text, date] of [[optional ? '시험일 미정' : '날짜 지우기', null], ['오늘', today]]) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = () => choose(date); footer.append(b); }
    picker.append(head, weekdays, days, footer);
  };
  refresh(); trigger.onclick = () => {
    if(activeCertificationPicker?.picker===picker){close();return;}
    closeDatePicker();shown=input.value?dateFromKey(input.value):today;render();
    $('certification-dialog').append(picker);picker.showPopover();activeCertificationPicker={picker,trigger};trigger.setAttribute('aria-expanded','true');positionCertificationPicker();
  };
  field.append(title,input,trigger);
  if (optional) { const help = document.createElement('p'); help.className = 'exam-date-help'; help.textContent = '날짜를 비워 두면 시험일 미정으로 등록됩니다.'; field.append(help); }
  return { field, input, refresh };
}
function certificationEditor(plan) {
  const form = document.createElement('form'); form.className = 'certification-form certification-editor';
  const label = document.createElement('label'); label.textContent = '자격증 이름';
  const name = document.createElement('input'); name.value = plan.name; name.required = true; name.maxLength = 60; label.append(name);
  const exam = editDateField(plan.examDate, '시험 날짜', true);
  let goals = (plan.goals || []).map(goal => ({ ...goal })); let goalEditing = null; let pendingGoal = null;
  const section = document.createElement('section'); section.className = 'goal-section';
  const header = document.createElement('div'); header.className = 'goal-header'; const heading = document.createElement('h3'); heading.textContent = '세부 목표 일정';
  const add = document.createElement('button'); add.type = 'button'; add.textContent = '+ 목표 추가'; header.append(heading, add);
  const list = document.createElement('div'); list.className = 'goal-list'; section.append(header, list);
  const error = document.createElement('p'); error.className = 'certification-edit-error'; error.setAttribute('role', 'alert');
  const button = (text, action) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = action; return b; };
  const iconButton = (kind, title, action) => {
    const b=button('',action);b.className='goal-icon-button';b.setAttribute('aria-label',title);b.title=title;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
    svg.innerHTML=kind==='pencil'?'<path d="m16 3 5 5M4 16 16 4a3.54 3.54 0 0 1 5 5L9 21l-6 1 1-6Z"/>':kind==='trash'?'<path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7"/>':'<path d="m6 6 12 12M18 6 6 18"/>';
    b.append(svg);return b;
  };
  const renderGoals = () => {
    closeDatePicker();list.replaceChildren();pendingGoal=null;add.hidden=goalEditing==='new';add.setAttribute('aria-expanded',String(goalEditing==='new'));
    if (!goals.length && goalEditing === null) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = '등록된 목표 일정이 없습니다.'; list.append(empty); }
    const rows = [...goals]; if (goalEditing === 'new') rows.push({ id: 'new', title: '', date: '' });
    for (const goal of rows) {
      const row = document.createElement('div'); row.className = 'goal-row';
      row.classList.add('goal-edit-row');
      const input=document.createElement('input');input.value=goal.title;input.placeholder='목표 이름';input.maxLength=100;input.setAttribute('aria-label','목표 이름');input.readOnly=goalEditing!==goal.id;
      const date=editDateField(goal.date,'목표 날짜');const dateButton=date.field.querySelector('.exam-date-trigger');dateButton.disabled=goalEditing!==goal.id;
      const milestone=document.createElement('div');milestone.className='goal-milestone';const toggleLabel=document.createElement('label'),toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=!!goal.milestone?.enabled;toggle.disabled=goalEditing!==goal.id;toggleLabel.append(toggle,document.createTextNode('학습 계획의 이정표로 사용'));const options=document.createElement('div');options.className='goal-milestone-options';let selected=new Set(resolvedMilestoneCategories(studyData,plan.id,goal.milestone));
      const draftGoal=()=>configureMilestone({...goal,id:goal.id==='new'?crypto.randomUUID():goal.id,title:input.value,date:date.input.value,source:goal.source||'user'},studyData,plan.id,toggle.checked,[...selected]);
      const syncMilestone=()=>{if(goal.id!=='new'){goal.milestone=toggle.checked?{enabled:true,planId:plan.id,date:date.input.value,categories:[...selected].map(category=>({category,itemIds:lectureItems(studyData).filter(item=>item.planId===plan.id&&item.category===category).map(item=>item.id)}))}:{enabled:false};}};
      const renderMilestone=()=>{options.hidden=!toggle.checked;options.replaceChildren();const title=document.createElement('p');title.textContent='목표일까지 완료할 학습 분류';options.append(title);const categories=milestoneCategories(studyData,plan.id);if(!categories.length){const empty=document.createElement('p');empty.className='empty-state';empty.textContent='이 자격증에 등록된 학습 분류가 없습니다.';options.append(empty);}for(const category of categories){const choice=document.createElement('label'),check=document.createElement('input'),dot=document.createElement('span');check.type='checkbox';check.checked=selected.has(category);check.disabled=goalEditing!==goal.id;check.onchange=()=>{check.checked?selected.add(category):selected.delete(category);syncMilestone();};dot.className='category-dot';dot.style.backgroundColor=categoryColor(plan.id,category);choice.append(check,dot,document.createTextNode(({theory:'이론',programming:'프로그래밍',sql:'SQL'})[category]||category));options.append(choice);}};
      toggle.onchange=()=>{syncMilestone();renderMilestone();};milestone.append(toggleLabel,options);renderMilestone();
      const actions=document.createElement('div');actions.className='goal-actions';
      if(goal.id==='new') {
        pendingGoal=()=>input.value.trim()||date.input.value||toggle.checked?draftGoal():null;
        actions.append(button('취소',()=>{goalEditing=null;error.textContent='';renderGoals();}),button('추가',()=>{try{goals.push(validateGoal(pendingGoal()));goalEditing=null;error.textContent='';renderGoals();}catch(e){error.textContent=e.message;}}));
      } else {
        input.oninput=()=>{goal.title=input.value;};date.input.onchange=()=>{goal.date=date.input.value;if(goal.milestone?.enabled)goal.milestone={...goal.milestone,date:goal.date};};
        const edit=button('수정',()=>{goalEditing=goal.id;renderGoals();list.querySelector('input:not([readonly])')?.focus();});edit.setAttribute('aria-label',`${goal.title} 목표 수정`);
        const remove=button('삭제',()=>{goals=goals.filter(g=>g.id!==goal.id);if(goalEditing===goal.id)goalEditing=null;renderGoals();});remove.setAttribute('aria-label',`${goal.title} 목표 삭제`);
        actions.append(edit,remove);
      }
      row.append(input,date.field,actions,milestone);
      list.append(row);
    }
  };
  add.onclick=()=>{goalEditing=goalEditing==='new'?null:'new';renderGoals();};renderGoals();
  const actions = document.createElement('div'); actions.className = 'certification-actions';
  const cancel = button('취소', () => { editingCertification = null; renderCertifications(); }); const save = document.createElement('button'); save.type = 'submit'; save.textContent = '저장'; actions.append(cancel, save);
  form.append(label, exam.field, section, error, actions);
  form.onsubmit = e => { e.preventDefault(); try { const pending=pendingGoal?.();const finalGoals=pending&&(pending.title.trim()||pending.date)?[...goals,validateGoal(pending)]:goals; const next = updateCertificationDetails(plans, plan.id, { name: name.value, examDate: exam.input.value, color: plan.color }, finalGoals); if (commitCertifications(next)) notify('자격증을 저장했습니다.'); else error.textContent = $('certification-error').textContent; } catch (e) { error.textContent = e.message; } };
  return form;
}
function renderCertifications() {
  closeDatePicker();
  certificationForm.hidden=editingCertification!==null;
  const list = $('certification-list'); list.replaceChildren();
  if (!plans.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = '등록된 자격증이 없습니다.'; list.append(empty); }
  for (const entry of certificationChoiceEntries(plans)) {
    if(entry.separator){const divider=document.createElement('div');divider.className='exam-option-separator';divider.textContent='지난 시험';list.append(divider);continue;}
    const plan=entry.plan;
    const row = document.createElement('div'); row.className = 'certification-row';
    const copy = document.createElement('div'); copy.className = 'certification-copy';
    const name = document.createElement('strong'); name.className = 'certification-name'; name.style.setProperty('--certification-color', plan.color || DEFAULT_CERTIFICATION_COLOR); name.textContent = plan.name;
    const date = document.createElement('small'); date.textContent = plan.examDate || '시험일 미정'; copy.append(name, date);
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = '수정'; edit.setAttribute('aria-label', `${plan.name} 수정`);
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '삭제'; remove.setAttribute('aria-label', `${plan.name} 삭제`);
    remove.addEventListener('click', () => {
      const confirmation = document.createElement('div'); confirmation.className = 'certification-delete';
      const message = document.createElement('p'); message.textContent = `“${plan.name}”을 삭제할까요? 개인 일정은 유지됩니다.`;
      const yes = document.createElement('button'); yes.type = 'button'; yes.textContent = '삭제 확인'; yes.addEventListener('click', () => { if (commitCertifications(deleteCertification(plans, plan.id))) notify('자격증을 삭제했습니다.'); });
      const no = document.createElement('button'); no.type = 'button'; no.textContent = '취소'; no.addEventListener('click', renderCertifications);
      confirmation.append(message, yes, no); row.replaceChildren(confirmation); no.focus();
    });
    const card = document.createElement('div'); card.className = 'certification-card';
    row.append(copy, edit, remove); card.append(row);
    edit.onclick = () => { editingCertification = plan.id; renderCertifications(); };
    edit.setAttribute('aria-expanded', String(editingCertification === plan.id));
    edit.hidden = remove.hidden = editingCertification === plan.id;
    if (editingCertification === plan.id) { card.classList.add('editing'); card.append(certificationEditor(plan)); }
    list.append(card);
  }
}
const addExam=editDateField(null,'시험 날짜',true);
addExam.input.name='examDate';addExam.field.querySelector('.exam-date-trigger').id='exam-date-trigger';
certificationForm.querySelector('.exam-date-field').replaceWith(addExam.field);
$('cancel-add-certification').addEventListener('click',resetCertificationForm);
certificationForm.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const next = upsertCertification(plans, { name: certificationForm.elements.name.value, examDate: certificationForm.elements.examDate.value, color: DEFAULT_CERTIFICATION_COLOR });
    if (commitCertifications(next)) notify('자격증을 저장했습니다.');
  } catch (error) { $('certification-error').textContent = error.message; $('certification-error').hidden = false; }
});
$('certification-settings').addEventListener('click', () => { setOptionsOpen(false); editingCertification = null; resetCertificationForm(); renderCertifications(); $('certification-dialog').showModal(); });
$('close-certifications').addEventListener('click', () => $('certification-dialog').close());
$('certification-dialog').addEventListener('click', event => { const rect = $('certification-dialog').getBoundingClientRect(); if (event.target === $('certification-dialog') && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) $('certification-dialog').close(); });
const availabilitySettings = initAvailabilityUI({ getPlans:()=>plans, getSelectedId:()=>state.planId, openButton: $('availability-settings'), onSave: () => { renderToday(); renderCalendar(); if (state.view === 'year') renderYear(); if ($('date-dialog').open) openDetail(dateFromKey(state.selected)); if(state.view==='planning')planningPage.render();notify('학습 가능 시간을 저장했습니다.'); } });
renderToday(); renderCalendar();
$('edit-today-time').addEventListener('click',()=>{goToToday();openDetail(today,true);});
alignSidebarTimeButton();
if (availabilitySettings.loadError) notify('학습 가능 시간을 불러오지 못했습니다. 기존 데이터는 유지됩니다.');
if (certificationLoadError) notify('저장된 자격증을 불러오지 못했습니다. 기존 저장 데이터는 유지됩니다.');
function syncSidebarSelection(){
  const selected=$('certification-dialog').open?'certification-settings':$('availability-dialog').open?'availability-settings':state.view==='study'?'study-settings':state.view==='planning'?'planning-nav':'schedule-nav';
  for(const item of document.querySelectorAll('.sidebar .nav-item')){
    const active=item.id===selected;item.classList.toggle('active',active);
    if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
  }
}
const sidebarDialogObserver=new MutationObserver(syncSidebarSelection);
for(const id of ['availability-dialog','certification-dialog'])sidebarDialogObserver.observe($(id),{attributes:true,attributeFilter:['open']});
syncSidebarSelection();

if(studyLoadError)notify('학습 데이터를 불러오거나 등록하지 못했습니다. 기존 데이터는 유지됩니다.');

initStudyTooltips();
