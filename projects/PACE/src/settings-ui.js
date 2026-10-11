import {loadTheme,saveTheme,loadWeekStart,saveWeekStart} from './display-settings.js';
import {openGuestReset} from './guest-reset.js';
import {initBackupImport} from './backup-import.js';
const menus=[['display','화면'],['data','데이터 관리'],['account','계정'],['about','PACE 정보']];
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
const button=(text,action)=>{const el=node('button',null,text);el.type='button';el.onclick=action;return el;};
export function openUnifiedSettings({initialMenu='display',sourceButton,storage,user,status,openLogin,renderAccountManagement,logout,guestStorage,onGuestReset,preferenceStorage}){
 const dialog=node('dialog','unified-settings');dialog.setAttribute('aria-label','PACE 설정');
 const head=node('header','unified-settings-heading'),close=button('×',()=>dialog.close());close.className='icon-button';close.setAttribute('aria-label','설정 닫기');head.append(node('h2',null,'설정'),close);
 const body=node('div','unified-settings-body'),nav=node('nav','unified-settings-menu'),content=node('section','unified-settings-content');nav.setAttribute('aria-label','설정 메뉴');content.id='unified-settings-content';body.append(nav,content);dialog.append(head,body);
 const title=text=>content.append(node('h3',null,text));
 const details=()=>{content.replaceChildren();content.scrollTop=0;title('계정 관리');const back=button('← 계정으로 돌아가기',()=>render('account'));back.className='settings-back';content.append(back);renderAccountManagement(content);};
 function render(menu){
  for(const entry of nav.querySelectorAll('button')){const selected=entry.dataset.menu===menu;entry.classList.toggle('active',selected);if(selected)entry.setAttribute('aria-current','page');else entry.removeAttribute('aria-current');}
  content.replaceChildren();content.classList.toggle('settings-data-content',menu==='data');content.scrollTop=0;
  if(menu==='display'){
   title('화면');
   const preferenceRow=(heading,description,choices,initial,save,kind)=>{const row=node('div','settings-display-row'),text=node('div','settings-account-feature-text'),options=node('div','settings-week-options settings-week-segments');text.append(node('h4',null,heading),node('p',null,description));options.setAttribute('role','group');options.setAttribute('aria-label',heading);let selected=initial;const notice=node('p','settings-note');notice.setAttribute('role','status');const update=()=>{for(const option of options.querySelectorAll('button'))option.setAttribute('aria-pressed',String(option.dataset.value===String(selected)));};for(const [value,label] of choices){const option=button(label,()=>{try{save(preferenceStorage,value);selected=value;notice.textContent='';update();}catch(error){notice.textContent=error.message;}});option.dataset.value=String(value);if(kind==='week')option.dataset.weekStart=String(value);options.append(option);}update();row.append(text,options);content.append(row,notice);};
   preferenceRow('달력 시작 요일','달력의 첫 번째 요일을 선택합니다.',[[0,'일요일'],[1,'월요일']],loadWeekStart(preferenceStorage),saveWeekStart,'week');
   preferenceRow('테마','PACE의 화면 색상을 설정합니다.',[['system','시스템 설정'],['light','라이트'],['dark','다크']],loadTheme(preferenceStorage),saveTheme,'theme');
  }else if(menu==='data'){
   title('데이터 관리');content.append(node('h4',null,'백업 관리'),node('p','settings-note','가져오기는 병합이 아닙니다. 현재 사용 중인 저장소의 pace.* 데이터를 백업 내용으로 교체합니다.'));
   const host=node('div','settings-backup-host'),trigger=button('백업 파일 가져오기',()=>{});content.append(host);initBackupImport({openButton:trigger,storage,container:host});trigger.click();
   const reset=node('section','settings-reset'),row=node('div','settings-reset-row'),resetButton=button('초기화',()=>openGuestReset({storage:guestStorage,onSuccess:onGuestReset}));resetButton.className='settings-reset-button';resetButton.disabled=!guestStorage||!onGuestReset;row.append(resetButton);reset.append(node('h4',null,'로컬 데이터 초기화'),node('p','settings-note','이 브라우저에 저장된 학습 데이터를 삭제합니다. 로그인 계정의 데이터는 유지됩니다.'),row);content.append(reset);
  }else if(menu==='account'){
   title('계정');
   if(!user){content.append(node('p','settings-note','로그인하지 않은 상태입니다.'),button('로그인 / 회원가입',()=>{dialog.close();openLogin();}));return;}
   status.classList.remove('settings-detail-sync');const summary=node('div','settings-account-summary'),icon=node('span','settings-user-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>';const info=node('div','settings-account-info');info.append(node('p','settings-email',user.email),status);summary.append(icon,info);content.append(summary);
   const actions=node('div','settings-account-actions'),message=node('p','settings-note');message.setAttribute('role','status');const signout=button('로그아웃',async()=>{signout.disabled=true;try{await logout();}catch(error){message.textContent='로그아웃 실패: '+(error.message||'네트워크 상태를 확인해 주세요.');signout.disabled=false;}});actions.append(button('계정 관리',details),signout);content.append(actions,message);
  }else{
   title('PACE 정보');content.append(node('strong','settings-product','PACE'),node('p',null,'자격증 학습 일정 관리 앱'),node('p','settings-note','버전 0.1.0'));
  }
 }
 for(const [id,label] of menus){const entry=button(label,()=>render(id));entry.dataset.menu=id;entry.setAttribute('aria-controls',content.id);nav.append(entry);}
 sourceButton?.classList.add('active');sourceButton?.setAttribute('aria-expanded','true');dialog.addEventListener('close',()=>{sourceButton?.classList.remove('active');sourceButton?.setAttribute('aria-expanded','false');dialog.remove();},{once:true});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 document.body.append(dialog);render(menus.some(([id])=>id===initialMenu)?initialMenu:'display');dialog.showModal();return dialog;
}

export function arrangeAccountActions(actions){
 const existing=Array.from(actions.querySelectorAll('button'));
 const specs=[['비밀번호 변경','계정의 로그인 비밀번호를 변경합니다.','비밀번호 변경','변경'],['로컬 기록 가져오기','이 브라우저의 학습 기록을 계정으로 복사합니다.','로컬 기록을 계정으로 복사','가져오기'],['동기화 다시 시도','동기화에 문제가 있을 때 다시 시도합니다.','동기화 다시 시도','다시 시도']];
 actions.replaceChildren();actions.className='settings-account-rows';
 for(const [title,description,original,label] of specs){const action=existing.find(b=>b.textContent===original);if(!action)continue;const row=node('div','settings-account-feature'),text=node('div','settings-account-feature-text');text.append(node('h4',null,title),node('p',null,description));action.textContent=label;row.append(text,action);actions.append(row);}
}
