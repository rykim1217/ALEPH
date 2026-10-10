import {populateCertificationSelect,defaultCertificationId} from './certifications.js';
import { dateKey, monthCells, shiftMonth, formatMinutes } from './calendar.js';
export const AVAILABILITY_KEY = 'pace.availability.v1';
export function emptyAvailability() { return { version: 1, mode: 'daily', daily: null, weekday: null, weekend: null, days: Array(7).fill(null), restDays: [], exceptions: {} }; }
export function validDate(key) { const d = new Date(`${key}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(key) && !key.startsWith('0000') && Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === key; }
function minutes(value) { if (value !== null && (!Number.isInteger(value) || value < 0 || value > 1440)) throw new Error('시간은 하루 0~24시간 범위로 입력해 주세요.'); return value; }
export function validateAvailability(value) {
  if (!value || value.version !== 1 || !['daily','split','weekly'].includes(value.mode) || !Array.isArray(value.days) || value.days.length !== 7 || !Array.isArray(value.restDays) || value.restDays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || !value.exceptions || typeof value.exceptions !== 'object' || Array.isArray(value.exceptions)) throw new Error('학습 가능 시간 설정을 확인해 주세요.');
  const exceptions = {};
  for (const [date, rule] of Object.entries(value.exceptions)) {
    if (!validDate(date) || !rule || !['rest','study'].includes(rule.kind)) throw new Error('올바른 예외 날짜를 선택해 주세요.');
    if (rule.kind === 'study' && rule.minutes === null) throw new Error('공부 가능한 시간을 입력해 주세요.');
    exceptions[date] = { kind: rule.kind, minutes: rule.kind === 'rest' ? 0 : minutes(rule.minutes) };
  }
  return { version:1, mode:value.mode, daily:minutes(value.daily), weekday:minutes(value.weekday), weekend:minutes(value.weekend), days:value.days.map(minutes), restDays:[...new Set(value.restDays)], exceptions };
}
export function resolveAvailability(date, settings) {
  const override = settings.exceptions[dateKey(date)];
  if (override) return { minutes: override.kind === 'rest' ? 0 : override.minutes, rest: override.kind === 'rest', source:'exception' };
  const day = date.getDay();
  if (settings.restDays.includes(day)) return { minutes:0, rest:true, source:'regular-rest' };
  return { minutes: settings.mode === 'daily' ? settings.daily : settings.mode === 'split' ? (day === 0 || day === 6 ? settings.weekend : settings.weekday) : settings.days[day], rest:false, source:'base' };
}
export function loadAvailability(storage) { const raw=storage.getItem(AVAILABILITY_KEY); return raw === null ? emptyAvailability() : validateAvailability(JSON.parse(raw)); }
export function saveAvailability(storage, settings) { const clean=validateAvailability(settings); storage.setItem(AVAILABILITY_KEY,JSON.stringify(clean)); return clean; }

export const AVAILABILITY_V2_KEY='pace.availability.v2';
export function hasLegacySettings(value) { return value && ([value.daily,value.weekday,value.weekend,...value.days].some(v=>v!==null)||value.restDays.length>0||Object.keys(value.exceptions).length>0); }
export function validateScopedRule(value) {
  if(!validDate(value.startDate)|| (value.endDate && (!validDate(value.endDate)||value.endDate<value.startDate))) throw Error('학습 시작일과 종료일을 확인해 주세요.');
  return {...validateAvailability(value),startDate:value.startDate,endDate:value.endDate||null};
}
export function loadScopedAvailability(storage) {
  const raw=storage.getItem(AVAILABILITY_V2_KEY);if(raw===null)return {version:2,certifications:{}};
  const data=JSON.parse(raw);if(data.version!==2||!data.certifications||typeof data.certifications!=='object'||Array.isArray(data.certifications))throw Error('자격증별 설정을 확인해 주세요.');
  const entries=Object.entries(data.certifications).map(([id,rule])=>{if(!id||id==='all')throw Error('학습 대상을 확인해 주세요.');return [id,validateScopedRule(rule)];});return {version:2,certifications:Object.fromEntries(entries)};
}
export function saveScopedAvailability(storage,data) {
  const clean=loadScopedAvailability({getItem:()=>JSON.stringify(data)});storage.setItem(AVAILABILITY_V2_KEY,JSON.stringify(clean));return clean;
}
export function resolveScopedAvailability(date,data,id) {
  const rule=data.certifications[id],key=dateKey(date);
  if(!rule)return {minutes:null,rest:false,source:'unset'};
  if(key<rule.startDate||(rule.endDate&&key>rule.endDate))return {minutes:null,rest:false,source:'outside-period'};
  return resolveAvailability(date,rule);
}

export function aggregateAvailability(date,data,ids) {
  const results=[...new Set(ids)].map(id=>resolveScopedAvailability(date,data,id)).filter(result=>result.source!=='outside-period');
  const unsetCount=results.filter(result=>result.minutes===null).length;
  const known=results.filter(result=>result.minutes!==null);
  return {minutes:known.length?known.reduce((sum,result)=>sum+result.minutes,0):null,rest:results.length>0&&results.every(result=>result.rest),unsetCount,activeCount:results.length,restCount:known.filter(result=>result.rest).length};
}
export function aggregateAvailabilityText(result) {
  if(result.rest||(result.restCount>0&&result.restCount===result.activeCount-result.unsetCount))return '휴식일';
  if(result.minutes===null)return '미설정';
  return formatMinutes(result.minutes);
}

export function updateDateException(data,id,key,rule) {
  const current=data.certifications[id];
  if(!current)throw Error('먼저 학습 가능시간 설정에서 이 자격증의 학습 시작일을 설정해 주세요.');
  if(!validDate(key)||key<current.startDate||(current.endDate&&key>current.endDate))throw Error('선택한 날짜가 이 자격증의 학습 기간 밖입니다.');
  const exceptions={...current.exceptions};if(rule===null)delete exceptions[key];else exceptions[key]=rule;
  return {...data,certifications:{...data.certifications,[id]:validateScopedRule({...current,exceptions})}};
}

export function resetScopedAvailability(data,id) {
  if(!id||id==='all')throw Error('초기화할 자격증을 선택해 주세요.');
  const certifications={...data.certifications};delete certifications[id];
  return {...data,certifications};
}

function confirmAvailabilityReset() {
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='availability-reset-confirm';dialog.setAttribute('aria-label','학습 가능시간 초기화 확인');
    const message=document.createElement('p');message.textContent='이 자격증의 학습 가능시간 설정을 모두 초기화할까요?';
    const actions=document.createElement('div');actions.className='certification-actions';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>dialog.close();
    const confirm=document.createElement('button');confirm.type='button';confirm.textContent='확인';confirm.onclick=()=>dialog.close('confirm');
    dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='confirm';dialog.remove();resolve(accepted);},{once:true});actions.append(cancel,confirm);dialog.append(message,actions);document.body.append(dialog);dialog.showModal();cancel.focus();
  });
}

export function initAvailabilityUI({ openButton, onSave, getPlans, getSelectedId }) {
  let settings, loadError = false;
  try { settings = loadScopedAvailability(localStorage); } catch { settings={version:2,certifications:{}}; loadError=true; }
  const dialog=document.createElement('dialog'); dialog.id='availability-dialog'; dialog.className='availability-dialog'; dialog.setAttribute('aria-label','학습 가능 시간 설정'); document.body.append(dialog);
  let draft, editingDate='',activeId='',drafts={},baselines={};
  function ruleFor(id){if(drafts[id])return drafts[id];const plan=getPlans().find(p=>p.id===id);let endDate=null;if(plan?.examDate){const date=new Date(plan.examDate+'T00:00:00');date.setDate(date.getDate()-1);endDate=dateKey(date);}const rule=structuredClone(settings.certifications[id]||{...emptyAvailability(),startDate:'',endDate});baselines[id]=JSON.stringify(rule);return drafts[id]=rule;}
  function datePicker(value,onChange,label){const dateInput=document.createElement('input');dateInput.type='hidden';dateInput.value=value;
    const field=document.createElement('div');field.className='exception-date-field';
    const trigger=document.createElement('button');trigger.type='button';trigger.className='exam-date-trigger';trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-expanded','false');
    const caption=document.createElement('span');const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.innerHTML='<rect x="4" y="6" width="16" height="15" rx="2"/><path d="M8 3v6M16 3v6M4 11h16"/>';icon.setAttribute('aria-hidden','true');trigger.append(caption,icon);
    const picker=document.createElement('div');picker.className='exam-date-picker';picker.hidden=true;picker.setAttribute('role','group');picker.setAttribute('aria-label','예외 날짜 달력');
    let shown=value?new Date(value+'T00:00:00'):new Date();
    const closePicker=()=>{picker.hidden=true;trigger.setAttribute('aria-expanded','false');};
    const choose=date=>{dateInput.value=date?dateKey(date):'';onChange(dateInput.value);caption.textContent=dateInput.value?dateInput.value.replaceAll('-','.'):label;closePicker();trigger.focus();};
    function renderPicker(){
      picker.replaceChildren();const head=document.createElement('div');head.className='date-picker-header';
      const title=document.createElement('span');title.textContent=shown.getFullYear()+'년 '+(shown.getMonth()+1)+'월';
      const nav=offset=>{const button=document.createElement('button');button.type='button';button.textContent=offset<0?'‹':'›';button.setAttribute('aria-label',offset<0?'예외 달력 이전 달':'예외 달력 다음 달');button.onclick=()=>{const next=shiftMonth(shown.getFullYear(),shown.getMonth(),offset);if(next.year<100||next.year>9999)return;shown=new Date(next.year,next.month,1);renderPicker();};return button;};head.append(nav(-1),title,nav(1));picker.append(head);
      const weekdays=document.createElement('div');weekdays.className='date-picker-weekdays';for(const name of weekdayNames){const span=document.createElement('span');span.textContent=name;weekdays.append(span);}picker.append(weekdays);
      const days=document.createElement('div');days.className='date-picker-days';for(const date of monthCells(shown.getFullYear(),shown.getMonth())){const button=document.createElement('button');button.type='button';button.textContent=date.getDate();button.className='picker-day'+(date.getMonth()!==shown.getMonth()?' outside':'')+(dateKey(date)===dateKey(new Date())?' today':'');button.setAttribute('aria-label',date.getFullYear()+'년 '+(date.getMonth()+1)+'월 '+date.getDate()+'일');button.setAttribute('aria-pressed',String(dateKey(date)===dateInput.value));button.onclick=()=>choose(date);days.append(button);}picker.append(days);
      const footer=document.createElement('div');footer.className='date-picker-footer';for(const [text,date] of [['날짜 지우기',null],['오늘',new Date()]]){const button=document.createElement('button');button.type='button';button.textContent=text;button.onclick=()=>choose(date);footer.append(button);}picker.append(footer);
    }
    caption.textContent=value?value.replaceAll('-','.'):label;trigger.onclick=()=>{if(!picker.hidden){closePicker();return;}renderPicker();picker.hidden=false;trigger.setAttribute('aria-expanded','true');};picker.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePicker();trigger.focus();}};
    field.append(dateInput,trigger,picker);return {field,dateInput};}
  function periodInput(label,value,setter){const row=document.createElement('label');row.className='availability-period';row.textContent=label;const {field}=datePicker(value||'',setter,label+' 선택');row.append(field);return row;}
  const weekdayNames=['일','월','화','수','목','금','토'];
  function timeInput(label, value, setter) {
    const row=document.createElement('label'); row.className='time-input-row'; const name=document.createElement('span'); name.textContent=label;
    const hour=document.createElement('input'), minute=document.createElement('input');
    for(const input of [hour,minute]) { input.type='number'; input.min='0'; input.step='1'; }
    hour.max='24'; minute.max='59'; hour.value=value === null?'':Math.floor(value/60); minute.value=value === null?'':value%60; hour.setAttribute('aria-label',label+' 시간'); minute.setAttribute('aria-label',label+' 분');
    const update=()=> { const h=hour.value === ''?0:Number(hour.value), m=minute.value === ''?0:Number(minute.value); setter(hour.value === ''&&minute.value === ''?null:h*60+m); };
    hour.addEventListener('input',update);minute.addEventListener('input',update);
    row.append(name,hour,document.createTextNode('시간'),minute,document.createTextNode('분')); return row;
  }
  function error(message) { dialog.querySelector('[role=alert]').textContent=message; }
  function render() {
    dialog.replaceChildren();
    const header=document.createElement('div');header.className='dialog-top';const title=document.createElement('h2');title.textContent='학습 가능 시간';const close=document.createElement('button');close.className='icon-button';close.type='button';close.textContent='×';close.setAttribute('aria-label','학습 가능 시간 닫기');close.onclick=()=>dialog.close();header.append(title,close);dialog.append(header);
    const form=document.createElement('form');form.className='availability-form';dialog.append(form);
    const targetLabel=document.createElement('label');targetLabel.className='availability-period';targetLabel.textContent='학습 대상';const target=document.createElement('select');target.setAttribute('aria-label','학습 대상');
    populateCertificationSelect(target,getPlans(),activeId);target.onchange=()=>{if(editingDate||dialog.querySelector('.exception-editor .exception-date-field input')?.value){error('작성 중인 날짜 예외를 반영하거나 날짜를 지운 뒤 대상을 변경해 주세요.');target.value=activeId;return;}activeId=target.value;draft=ruleFor(activeId);render();};targetLabel.append(target);form.append(targetLabel);
    if(!activeId){const empty=document.createElement('p');empty.className='dialog-note';empty.textContent='먼저 시험 설정에서 자격증을 등록해 주세요.';form.append(empty);return;}
    form.append(periodInput('학습 시작일',draft.startDate,v=>draft.startDate=v),periodInput('학습 종료일 · 선택 사항',draft.endDate,v=>draft.endDate=v||null));
    const tabs=document.createElement('div');tabs.className='availability-modes';
    for(const [mode,label] of [['daily','매일 동일'],['split','평일/주말'],['weekly','요일별']]) { const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(draft.mode===mode));button.onclick=()=>{draft.mode=mode;render();};tabs.append(button); }form.append(tabs);
    if(draft.mode==='daily')form.append(timeInput('매일',draft.daily,v=>draft.daily=v));
    else if(draft.mode==='split') {form.append(timeInput('평일',draft.weekday,v=>draft.weekday=v),timeInput('주말',draft.weekend,v=>draft.weekend=v));}
    else for(const day of [1,2,3,4,5,6,0])form.append(timeInput(weekdayNames[day]+'요일',draft.days[day],v=>draft.days[day]=v));
    const heading=document.createElement('h3');heading.textContent='정기 휴식일';form.append(heading);const rest=document.createElement('div');rest.className='rest-days';
    for(const day of [1,2,3,4,5,6,0]) {const button=document.createElement('button');button.type='button';button.textContent=weekdayNames[day];button.setAttribute('aria-label',weekdayNames[day]+'요일 휴식');button.setAttribute('aria-pressed',String(draft.restDays.includes(day)));button.onclick=()=>{draft.restDays=draft.restDays.includes(day)?draft.restDays.filter(d=>d!==day):[...draft.restDays,day];button.setAttribute('aria-pressed',String(draft.restDays.includes(day)));};rest.append(button);}form.append(rest);
    const exTitle=document.createElement('h3');exTitle.textContent='날짜별 예외';form.append(exTitle);
    const list=document.createElement('div');list.className='availability-exceptions';
    for(const [date,rule] of Object.entries(draft.exceptions).sort()) { const row=document.createElement('div');row.className='exception-row';const text=document.createElement('span');text.textContent=date+' · '+(rule.kind==='rest'?'휴식':`${Math.floor(rule.minutes/60)}시간 ${rule.minutes%60}분`);const edit=document.createElement('button');edit.type='button';edit.textContent='수정';edit.setAttribute('aria-label',date+' 예외 수정');edit.onclick=()=>{editingDate=date;render();};const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';remove.setAttribute('aria-label',date+' 예외 삭제');remove.onclick=()=>{delete draft.exceptions[date];if(editingDate===date)editingDate='';render();};row.append(text,edit,remove);list.append(row); }if(!list.childElementCount)list.textContent='등록된 날짜 예외가 없습니다.';form.append(list);
    const editor=document.createElement('section');editor.className='exception-editor'; const dateLabel=document.createElement('label');dateLabel.textContent='예외 날짜';const {field,dateInput}=datePicker(editingDate,()=>{},'예외 날짜 선택');dateLabel.append(field);editor.append(dateLabel);
    let rule=editingDate && draft.exceptions[editingDate] ? {...draft.exceptions[editingDate]} : {kind:'study',minutes:null};
    const kindLabel=document.createElement('label');kindLabel.textContent='해당 날짜 상태';const kind=document.createElement('select');for(const [value,label] of [['study','공부 가능'],['rest','휴식']]) {const option=document.createElement('option');option.value=value;option.textContent=label;kind.append(option);}kind.value=rule.kind;kindLabel.append(kind);editor.append(kindLabel);
    const time=timeInput('공부 가능 시간',rule.minutes,v=>rule.minutes=v);
    const updateTimeState=()=>{ const disabled=rule.kind==='rest'; time.classList.toggle('disabled',disabled); for(const input of time.querySelectorAll('input')) input.disabled=disabled; };
    updateTimeState();kind.onchange=()=>{rule.kind=kind.value;updateTimeState();};editor.append(time);
    const add=document.createElement('button');add.type='button';add.textContent=editingDate && draft.exceptions[editingDate]?'예외 수정 반영':'예외 추가';add.onclick=()=>{try{if(!validDate(dateInput.value))throw Error('예외 날짜를 선택해 주세요.');const next={...draft,exceptions:{...draft.exceptions,[dateInput.value]:rule}};validateAvailability(next);if(editingDate&&editingDate!==dateInput.value)delete next.exceptions[editingDate];drafts[activeId]=draft=next;editingDate='';render();}catch(e){error(e.message);}};editor.append(add);form.append(editor);
    const help=document.createElement('p');help.className='dialog-note';help.textContent='날짜별 예외가 기본 설정보다 우선 적용되며, 삭제하면 기존 설정으로 돌아갑니다.';form.append(help);
    const alert=document.createElement('p');alert.setAttribute('role','alert');alert.className='availability-error';form.append(alert);
    const actions=document.createElement('div');actions.className='certification-actions';const reset=document.createElement('button');reset.type='button';reset.className='availability-reset';reset.textContent='설정 초기화';
    reset.onclick=async()=>{if(!await confirmAvailabilityReset())return;try{if(loadError)throw Error('기존 설정을 불러오지 못해 초기화를 중단했습니다.');if(!getPlans().some(plan=>plan.id===activeId))throw Error('학습 대상을 확인해 주세요.');settings=saveScopedAvailability(localStorage,resetScopedAvailability(settings,activeId));drafts[activeId]=draft={...emptyAvailability(),startDate:'',endDate:null};baselines[activeId]=JSON.stringify(draft);editingDate='';render();onSave();}catch(err){error(err.message);}};
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>dialog.close();const save=document.createElement('button');save.type='submit';save.textContent='설정 저장';actions.append(reset,cancel,save);form.append(actions);
    form.onsubmit=e=>{e.preventDefault();try{if(loadError)throw Error('기존 설정을 불러오지 못해 덮어쓰기를 중단했습니다.');if(dateInput.value){error('작성 중인 날짜 예외를 먼저 반영하거나 날짜를 비워 주세요.');return;}validateScopedRule(draft);drafts[activeId]=draft;const updated=Object.fromEntries(Object.entries(drafts).filter(([id,rule])=>id===activeId||JSON.stringify(rule)!==baselines[id]).map(([id,rule])=>[id,validateScopedRule(rule)]));settings=saveScopedAvailability(localStorage,{...settings,certifications:{...settings.certifications,...updated}});dialog.close();onSave();}catch(err){error(err.message==='QuotaExceededError'?'저장 공간을 확인해 주세요.':err.message);}};
  }
  function open() { drafts={};baselines={};activeId=defaultCertificationId(getPlans(),getSelectedId());draft=ruleFor(activeId);editingDate='';render();if(!dialog.open)dialog.showModal(); }
  openButton.addEventListener('click',()=>open());
  dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});
  return { open, resolve:date=>resolveScopedAvailability(date,settings,getSelectedId()), aggregate:date=>aggregateAvailability(date,settings,getPlans().map(plan=>plan.id)),
    rule:id=>settings.certifications[id],
    updateException:(id,key,rule)=>{if(loadError)throw Error('기존 설정을 불러오지 못해 저장을 중단했습니다.');if(!getPlans().some(plan=>plan.id===id))throw Error('학습 대상을 확인해 주세요.');settings=saveScopedAvailability(localStorage,updateDateException(settings,id,key,rule));onSave();},loadError };
}
