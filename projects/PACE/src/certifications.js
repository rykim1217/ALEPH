import {lectureItems} from './study.js';
import {orderedCategories} from './category-order.js';
export const CERTIFICATION_STORAGE_KEY = 'pace.certifications.v1';
export const DEFAULT_CERTIFICATION_COLOR = '#F06B85';

export function validateCertification(input) {
  const name = String(input.name || '').trim();
  const examDate = input.examDate || null;
  const color = input.color;
  if (!name || name.length > 60) throw new Error('자격증 이름을 1~60자로 입력해 주세요.');
  if (examDate) {
    const date = new Date(`${examDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== examDate || examDate.startsWith('0000')) {
      throw new Error('올바른 시험 날짜를 입력해 주세요.');
    }
  }
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('올바른 구분 색상을 선택해 주세요.');
  return { name, examDate, color };
}

export function upsertCertification(plans, input, id = null) {
  const values = validateCertification(input);
  if (id && !plans.some(plan => plan.id === id)) throw new Error('수정할 자격증을 찾을 수 없습니다.');
  if (id) return plans.map(plan => plan.id === id ? { ...plan, ...values, examLabel: plan.name === values.name ? plan.examLabel : `${values.name} 시험` } : plan);
  const newId = globalThis.crypto?.randomUUID?.() || `cert-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return [...plans, { ...values, id: newId, source: 'user' }];
}

export function deleteCertification(plans, id) {
  return plans.filter(plan => plan.id !== id);
}

export function loadCertifications(storage, defaults) {
  const raw = storage.getItem(CERTIFICATION_STORAGE_KEY);
  if (raw === null) return defaults.map(plan => ({ ...plan, color: plan.color || DEFAULT_CERTIFICATION_COLOR }));
  const stored = JSON.parse(raw);
  if (!Array.isArray(stored)) throw new Error('Invalid certification data');
  const ids = new Set();
  return stored.map(plan => {
    if (!plan || typeof plan.id !== 'string' || !plan.id || plan.id === 'all' || ids.has(plan.id)) throw new Error('Invalid certification id');
    ids.add(plan.id);
    if (plan.goals !== undefined) {
      if (!Array.isArray(plan.goals)) throw new Error('Invalid goal data');
      const goals = plan.goals.map(validateGoal);
      if (new Set(goals.map(goal => goal.id)).size !== goals.length) throw new Error('Invalid goal ids');
    }
    return { ...plan, ...validateCertification(plan) };
  });
}

export function saveCertifications(storage, plans) {
  storage.setItem(CERTIFICATION_STORAGE_KEY, JSON.stringify(plans));
}

export function validateGoal(goal) {
  if (!goal || typeof goal.id !== 'string' || !goal.id || typeof goal.title !== 'string' || !goal.title.trim() || goal.title.trim().length > 100) throw new Error('목표 이름을 1~100자로 입력해 주세요.');
  if (!goal.date) throw new Error('목표 날짜를 선택해 주세요.');
  validateCertification({ name: '목표', examDate: goal.date, color: DEFAULT_CERTIFICATION_COLOR });
  if(goal.milestone!==undefined){const m=goal.milestone;if(!m||typeof m.enabled!=='boolean')throw Error('이정표 설정을 확인해 주세요.');if(m.enabled&&(!m.planId||m.date!==goal.date||!Array.isArray(m.categories)||!m.categories.length||m.categories.some(ref=>!ref.category||!Array.isArray(ref.itemIds)||!ref.itemIds.length||ref.itemIds.some(id=>typeof id!=='string'||!id))))throw Error('목표일까지 완료할 학습 분류를 1개 이상 선택해 주세요.');}
  return { ...goal, title: goal.title.trim() };
}

// Commit the certificate and its draft goals together, preserving unrelated fields.
export function updateCertificationDetails(plans, id, input, goals) {
  const clean = goals.map(validateGoal);if(clean.some(goal=>goal.milestone?.enabled&&goal.milestone.planId!==id))throw Error('이정표의 자격증 연결을 확인해 주세요.');
  if (new Set(clean.map(goal => goal.id)).size !== clean.length) throw new Error('목표 ID가 중복됩니다.');
  return upsertCertification(plans, input, id).map(plan => plan.id === id ? { ...plan, goals: clean } : plan);
}

// Stable item IDs resolve the current category after a category rename.
export function milestoneCategories(data,planId){const items=lectureItems(data).filter(item=>item.planId===planId);return orderedCategories(data,planId,items.map(item=>item.category));}
export function resolvedMilestoneCategories(data,planId,milestone){
 if(!milestone?.enabled||milestone.planId!==planId)return [];
 const items=lectureItems(data).filter(item=>item.planId===planId),result=new Set();
 for(const ref of milestone.categories||[]){const matches=items.filter(item=>ref.itemIds?.includes(item.id));if(matches.length)for(const item of matches)result.add(item.category);else if(items.some(item=>item.category===ref.category))result.add(ref.category);}
 return milestoneCategories(data,planId).filter(category=>result.has(category));
}
export function configureMilestone(goal,data,planId,enabled,categories=[]){
 if(!enabled)return {...goal,milestone:{enabled:false}};
 const items=lectureItems(data).filter(item=>item.planId===planId),unique=[...new Set(categories)];
 if(!unique.length||unique.some(category=>!items.some(item=>item.category===category)))throw Error('해당 자격증의 학습 분류를 1개 이상 선택해 주세요.');
 return validateGoal({...goal,milestone:{enabled:true,planId,date:goal.date,categories:unique.map(category=>({category,itemIds:items.filter(item=>item.category===category).map(item=>item.id)}))}});
}

// Display-only ordering; never changes exam dates, completion or persisted plan order.
export function orderedCertificationChoices(plans,today=new Date()){
 const key=String(today.getFullYear()).padStart(4,'0')+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
 const rank=plan=>!plan.examDate?1:plan.examDate>=key?0:2;
 return plans.map((plan,index)=>({plan,index})).sort((a,b)=>rank(a.plan)-rank(b.plan)||(rank(a.plan)===0?a.plan.examDate.localeCompare(b.plan.examDate):0)||a.index-b.index).map(entry=>entry.plan);
}
export function defaultCertificationId(plans,manualId=null,today=new Date()){return plans.some(plan=>plan.id===manualId)?manualId:orderedCertificationChoices(plans,today)[0]?.id||'';}

export function certificationChoiceEntries(plans,today=new Date()){const key=String(today.getFullYear()).padStart(4,'0')+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');let separated=false;const result=[];for(const plan of orderedCertificationChoices(plans,today)){if(plan.examDate&&plan.examDate<key&&!separated){result.push({separator:true,label:'──────── 지난 시험 ────────'});separated=true;}result.push({plan});}return result;}
export function populateCertificationSelect(select,plans,selectedId=null,today=new Date()){select.replaceChildren();for(const entry of certificationChoiceEntries(plans,today)){const option=select.ownerDocument.createElement('option');if(entry.separator){option.textContent=entry.label;option.disabled=true;option.value='';}else{option.value=entry.plan.id;option.textContent=entry.plan.name;}select.append(option);}select.value=defaultCertificationId(plans,selectedId,today);queueMicrotask(()=>{if(select.isConnected)enhanceCertificationSelect(select,plans,today);});return select.value;}

function enhanceCertificationSelect(select,plans,today){
 const doc=select.ownerDocument;let widget=select._paceCertificationWidget;
 if(!widget){const wrap=doc.createElement('span'),trigger=doc.createElement('button'),menu=doc.createElement('div');wrap.className='pace-cert-selector';trigger.type='button';trigger.className='pace-cert-trigger';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label',select.getAttribute('aria-label')||'자격증 선택');menu.className='pace-cert-menu';menu.setAttribute('popover','auto');menu.setAttribute('role','listbox');menu.id='pace-cert-menu-'+crypto.randomUUID();trigger.setAttribute('aria-controls',menu.id);select.before(wrap);wrap.append(select,trigger,menu);select.classList.add('pace-cert-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');widget={wrap,trigger,menu,plans,today};select._paceCertificationWidget=widget;
  function close(){if(menu.matches(':popover-open'))menu.hidePopover();}
  function open(){if(select.disabled)return;widget.draw();menu.showPopover();const rect=trigger.getBoundingClientRect(),width=Math.min(rect.width,innerWidth-24);menu.style.width=width+'px';const bounds=menu.getBoundingClientRect();menu.style.left=Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px';menu.style.top=(rect.bottom+7+bounds.height<=innerHeight-12?rect.bottom+7:Math.max(12,rect.top-bounds.height-7))+'px';(menu.querySelector('[aria-selected="true"]')||menu.querySelector('button'))?.focus();}
  trigger.onclick=event=>{event.preventDefault();event.stopPropagation();if(menu.matches(':popover-open'))close();else open();};trigger.onkeydown=event=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){event.preventDefault();open();}};menu.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));menu.onkeydown=event=>{const options=[...menu.querySelectorAll('button')],index=options.indexOf(doc.activeElement);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();options[(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();}else if(event.key==='Home'||event.key==='End'){event.preventDefault();options[event.key==='Home'?0:options.length-1]?.focus();}else if(event.key==='Escape'){event.preventDefault();close();trigger.focus();}};
  select.addEventListener('change',()=>widget.draw());
  widget.draw=()=>{trigger.replaceChildren();const active=widget.plans.find(plan=>plan.id===select.value),label=doc.createElement('span'),arrow=doc.createElement('span');label.textContent=active?.name||'자격증 선택';arrow.className='pace-cert-chevron';arrow.setAttribute('aria-hidden','true');trigger.append(label,arrow);trigger.disabled=select.disabled;menu.replaceChildren();for(const entry of certificationChoiceEntries(widget.plans,widget.today)){if(entry.separator){const divider=doc.createElement('div');divider.className='exam-option-separator';divider.setAttribute('role','separator');divider.textContent='지난 시험';menu.append(divider);continue;}const plan=entry.plan,row=doc.createElement('button'),name=doc.createElement('span'),dot=doc.createElement('span'),text=doc.createElement('span'),dday=doc.createElement('span');row.type='button';row.className='pace-cert-option';row.setAttribute('role','option');row.setAttribute('aria-selected',String(plan.id===select.value));name.className='pace-cert-option-name';dot.className='category-dot';dot.style.backgroundColor=plan.color||DEFAULT_CERTIFICATION_COLOR;text.textContent=plan.name;name.append(dot,text);dday.className='pace-cert-dday';if(plan.examDate){const current=new Date(widget.today.getFullYear(),widget.today.getMonth(),widget.today.getDate()),difference=Math.round((new Date(plan.examDate+'T00:00:00')-current)/86400000);dday.textContent=difference===0?'D-day':difference>0?'D-'+difference:'D+'+Math.abs(difference);}else dday.textContent='시험일 미정';row.append(name,dday);row.onclick=event=>{event.preventDefault();event.stopPropagation();close();select.value=plan.id;select.dispatchEvent(new Event('change',{bubbles:true}));widget.draw();if(trigger.isConnected)trigger.focus();};menu.append(row);}};
 }
 widget.plans=plans;widget.today=today;widget.draw();
}
