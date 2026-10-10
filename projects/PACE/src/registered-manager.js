import {orderedCategories,moveCategory} from './category-order.js';
import {lectureItems,formatLectureTime,parseLectureTime,parseExpectedMinutes,formatExpectedMinutes} from './study.js';
import {updateStudyItem,deleteStudyItems,canBatchEditTime,updateStudyCategory,categoryTimeValue} from './study-item-edit.js';

export function initRegisteredManager({root,target,getData,save,colorFor,names,categoryKey}){
 const list=root.querySelector('.registered-list'),remove=root.querySelector('.delete-selected');
 const selections=new Map(),active=new Map(),positions=new Map();let editing=null,layoutObserver=null,dragCategory=null,suppressClickUntil=0;
 const selected=()=>{if(!selections.has(target.value))selections.set(target.value,new Set());return selections.get(target.value);};
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
 const button=(text,action,cls)=>{const node=el('button',cls,text);node.type='button';node.onclick=action;return node;};
 const check=(label,checked,action)=>{const node=el('input');node.type='checkbox';node.checked=checked;node.setAttribute('aria-label',label);node.onchange=()=>action(node.checked);return node;};
 const refreshActions=()=>{remove.disabled=!selected().size;};
 const categoryDialog=el('dialog','study-time-dialog');root.append(categoryDialog);
 function editCategory(category){
  const planId=target.value,members=lectureItems(getData()).filter(i=>i.planId===planId&&i.category===category),editable=members.every(canBatchEditTime);
  categoryDialog.replaceChildren(el('h3',null,'학습 분류 수정'));const form=el('form');
  const nameLabel=el('label',null,'분류명'),nameInput=el('input');nameInput.value=names[category]||category;nameInput.required=true;nameInput.maxLength=60;nameInput.setAttribute('aria-label','변경할 학습 분류명');nameLabel.append(nameInput);form.append(nameLabel);
  let timeInput,timeDirty=false;const timeState=categoryTimeValue(members);if(editable){const timeLabel=el('label','category-time-label','예상 시간 (분 · 선택)');timeInput=el('input');timeInput.type='number';timeInput.step='any';timeInput.value=timeState.value??'';timeInput.placeholder=timeState.mixed?'항목별 시간 다름':'미설정';timeInput.oninput=()=>{timeDirty=true;};timeInput.setAttribute('aria-label','분류 전체 예상 시간 (분)');timeLabel.append(timeInput);form.append(timeLabel,el('p','category-time-hint','입력한 시간은 전체 적용되며, 비우면 미설정됩니다.'));}
  const error=el('p','management-error');error.setAttribute('role','status');const actions=el('footer','management-actions'),submit=el('button',null,'저장');submit.type='submit';actions.append(button('취소',()=>categoryDialog.close()),submit);form.append(error,actions);
  form.onsubmit=event=>{event.preventDefault();try{const name=nameInput.value.trim(),next=updateStudyCategory(getData(),planId,category,{name,expectedMinutes:timeInput&&(!timeState.mixed||timeDirty)?parseExpectedMinutes(timeInput.value):undefined,color:colorFor(planId,category)});save(next);active.set(planId,name===(names[category]||category)?category:name);const oldPosition=positions.get(planId+'|'+category);if(oldPosition!=null)positions.set(planId+'|'+active.get(planId),oldPosition);categoryDialog.close();render();}catch(e){error.textContent=e.message;}};
  categoryDialog.append(form);categoryDialog.showModal();nameInput.focus();
 }
 const dialog=el('dialog','study-delete-dialog');root.append(dialog);
 remove.onclick=()=>{
  const planId=target.value,ids=[...selected()];if(!ids.length)return;
  dialog.replaceChildren(el('h3',null,'선택 삭제'),el('p',null,'선택한 학습 항목 '+ids.length+'개를 삭제할까요?'));
  const error=el('p','management-error');error.setAttribute('role','status');const actions=el('footer','management-actions');
  actions.append(button('취소',()=>dialog.close()),button('삭제',()=>{try{const next=deleteStudyItems(getData(),planId,ids);save(next);ids.forEach(id=>selections.get(planId)?.delete(id));editing=null;dialog.close();render();}catch(e){error.textContent=e.message;}}));dialog.append(error,actions);dialog.showModal();
 };
 function render(){
  layoutObserver?.disconnect();
  const previous=list.querySelector('.managed-items');if(previous)positions.set(previous.dataset.key,previous.scrollTop);
  const items=lectureItems(getData()).filter(i=>i.planId===target.value),selection=selected();
  for(const id of selection)if(!items.some(i=>i.id===id))selection.delete(id);
  refreshActions();list.replaceChildren();
  if(!items.length){list.append(el('p','empty-state','등록된 학습 항목이 없습니다.'));return;}
  const categories=orderedCategories(getData(),target.value,items.map(i=>i.category)),cards=el('div','study-category-cards');
  if(!active.has(target.value)||(active.get(target.value)!==null&&!categories.includes(active.get(target.value))))active.set(target.value,categories[0]);
  for(const category of categories){const members=items.filter(i=>i.category===category),name=names[category]||category;
   const card=button(null,event=>{if(Date.now()<suppressClickUntil||event.target.closest('.category-drag-handle'))return;active.set(target.value,active.get(target.value)===category?null:category);editing=null;render();},'study-category-card');
   card.classList.toggle('is-active',active.get(target.value)===category);card.setAttribute('aria-expanded',String(active.get(target.value)===category));card.title=name;
   const dot=el('span','category-dot');dot.style.backgroundColor=colorFor(target.value,category);card.append(dot,el('span','category-card-name',name),el('span','category-card-count',members.length+'개'));const handle=el('span','category-drag-handle');handle.draggable=true;handle.title=name+' 순서 이동';handle.setAttribute('aria-label',name+' 순서 이동');handle.innerHTML='<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="3" r="1"/><circle cx="7" cy="3" r="1"/><circle cx="3" cy="8" r="1"/><circle cx="7" cy="8" r="1"/><circle cx="3" cy="13" r="1"/><circle cx="7" cy="13" r="1"/></svg>';
   handle.onclick=event=>event.stopPropagation();
   const clearTargets=()=>cards.querySelectorAll('.drop-before,.drop-after').forEach(node=>node.classList.remove('drop-before','drop-after'));
   handle.ondragstart=event=>{dragCategory=category;suppressClickUntil=Date.now()+600;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',category);event.dataTransfer.setDragImage(card,20,20);card.classList.add('is-dragging');event.stopPropagation();};
   handle.ondragend=()=>{dragCategory=null;suppressClickUntil=Date.now()+400;card.classList.remove('is-dragging');clearTargets();};
   card.ondragover=event=>{if(dragCategory==null||dragCategory===category)return;event.preventDefault();event.dataTransfer.dropEffect='move';clearTargets();const rect=card.getBoundingClientRect();card.classList.add(event.clientX>rect.left+rect.width/2?'drop-after':'drop-before');};
   card.ondragleave=event=>{if(!card.contains(event.relatedTarget))card.classList.remove('drop-before','drop-after');};
   card.ondrop=event=>{if(dragCategory==null)return;event.preventDefault();event.stopPropagation();const rect=card.getBoundingClientRect(),next=moveCategory(getData(),target.value,categories,dragCategory,category,event.clientX>rect.left+rect.width/2);dragCategory=null;suppressClickUntil=Date.now()+400;clearTargets();try{if(next!==getData())save(next);}catch(e){const error=el('p','management-error',e.message);list.prepend(error);} };
   card.append(handle);cards.append(card);
  }list.append(cards);
  const category=active.get(target.value);if(!categories.includes(category))return;
  const members=items.filter(i=>i.category===category),name=names[category]||category;
  const detail=el('section','managed-detail'),heading=el('div','managed-heading'),all=check(name+' 전체 선택',false,value=>{members.forEach(i=>value?selection.add(i.id):selection.delete(i.id));render();});
  const count=members.filter(i=>selection.has(i.id)).length;all.checked=count===members.length;all.indeterminate=count>0&&count<members.length;
  const headingTitle=el('div','managed-category-title'),rename=button(null,()=>editCategory(category),'edit-study-item');rename.setAttribute('aria-label',name+' 분류 수정');rename.title='분류 수정';rename.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5"/></svg>';headingTitle.append(el('h4',null,name+' · '+members.length+'개'));const headingActions=el('div','managed-heading-actions');headingActions.append(rename,all);heading.append(headingTitle,headingActions);detail.append(heading);
  const scroll=el('div','managed-items');scroll.dataset.key=target.value+'|'+category;
  for(const item of members){const wrapper=el('div','managed-item-wrapper'),row=el('div','managed-item-row');const dot=el('span','category-dot');dot.style.backgroundColor=colorFor(target.value,category);
   const title=item.number&&item.studyKind==='lecture'?item.number+' '+item.title:item.title;
   const label=el('span','managed-item-name',title);label.title=title;
   const pencil=button(null,()=>{editing=editing===item.id?null:item.id;render();},'edit-study-item');pencil.setAttribute('aria-label',title+' 수정');pencil.title='수정';pencil.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5"/></svg>';
   row.append(dot,label,el('span','registered-lecture-time',item.studyKind&&item.studyKind!=='lecture'?formatExpectedMinutes(item.expectedMinutes):item.originalSeconds==null?'':formatLectureTime(item.originalSeconds)),pencil,check(title+' 선택',selection.has(item.id),value=>{value?selection.add(item.id):selection.delete(item.id);const n=members.filter(i=>selection.has(i.id)).length;all.checked=n===members.length;all.indeterminate=n>0&&n<members.length;refreshActions();}));wrapper.append(row);
   if(editing===item.id){const form=el('form','managed-edit-form'),fields={};
    function field(key,label,value){const holder=el('label','edit-field-'+key,label),input=el('input');input.value=value??'';input.setAttribute('aria-label',title+' '+label);holder.append(input);form.append(holder);fields[key]=input;}
    if(item.number!=null)field('number','번호',item.number);field('title','항목명',item.title);field('category','학습 분류',names[item.category]||item.category);if(item.studyKind&&item.studyKind!=='lecture'){field('time','예상 시간 (분)',item.expectedMinutes);fields.time.type='number';fields.time.step='any';fields.time.placeholder='선택 입력';}else if(item.originalSeconds!=null)field('time','강의 시간',formatLectureTime(item.originalSeconds));
    const error=el('p','management-error');error.setAttribute('role','status');const actions=el('div','management-actions');const submit=el('button',null,'저장');submit.type='submit';actions.append(button('취소',()=>{editing=null;render();}),submit);form.append(error,actions);
    form.onsubmit=event=>{event.preventDefault();try{const changes={title:fields.title.value,category:categoryKey(fields.category.value)};if(fields.number)changes.number=fields.number.value;if(fields.time){if(item.studyKind&&item.studyKind!=='lecture')changes.expectedMinutes=parseExpectedMinutes(fields.time.value);else changes.originalSeconds=parseLectureTime(fields.time.value);}const next=updateStudyItem(getData(),item.id,changes);editing=null;active.set(target.value,changes.category);save(next);render();}catch(e){error.textContent=e.message;}};wrapper.append(form);
   }scroll.append(wrapper);
  }detail.append(scroll);list.append(detail);
  const alignChecks=()=>{heading.style.paddingRight=(16+(scroll.offsetWidth-scroll.clientWidth)+2)+'px';};
  layoutObserver=new ResizeObserver(alignChecks);layoutObserver.observe(scroll);layoutObserver.observe(scroll.firstElementChild);alignChecks();
  scroll.scrollTop=positions.get(scroll.dataset.key)||0;
 }
 return {render};
}
