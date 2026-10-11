import {openAccountReset} from '../src/account-reset-dialog.js';
import {openPasswordChange} from '../src/password-change-dialog.js';
import {confirmLocalCopy} from '../src/local-copy-dialog.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {openGuestReset} from '../src/guest-reset.js';
import {emptyStudy,STUDY_KEY} from '../src/study.js';
import {openUnifiedSettings,arrangeAccountActions} from '../src/settings-ui.js';
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.className='';this.events={};this.disabled=false;this.value='';this._text='';this.classList={add:(name)=>{if(!this.className.split(' ').includes(name))this.className+=' '+name;},remove:name=>{this.className=this.className.split(' ').filter(x=>x!==name).join(' ');},toggle:(name,on)=>on?this.classList.add(name):this.classList.remove(name)};}
 set textContent(text){this._text=text;this.children=[];}get textContent(){return this._text+this.children.map(x=>typeof x==='string'?x:x.textContent).join('');}
 append(...items){for(const item of items){if(typeof item!=='string'){item.remove();item.parent=this;}this.children.push(item);}}
 replaceChildren(...items){this._text='';this.children=[];this.append(...items);}
 setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
 querySelectorAll(tag){return this.children.flatMap(x=>typeof x==='string'?[]:[...(x.tagName===tag?[x]:[]),...x.querySelectorAll(tag)]);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}
 get parentElement(){return this.parent;}
 showModal(){this.open=true;}close(){this.open=false;for(const f of this.events.close||[])f();}click(){if(!this.disabled)return this.onclick?.();}
}
function fixture(options={}){
 const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag),body:new Element('body')};
 const preferenceValues=new Map(),preferenceStorage={getItem:key=>preferenceValues.get(key)??null,setItem:(key,value)=>preferenceValues.set(key,value)};
 const storage={length:1,key:()=> 'pace.certifications.v1',getItem:key=>key==='pace.certifications.v1'?'[]':null,setItem:()=>assert.fail('UI must not write data'),removeItem:()=>assert.fail('UI must not remove data')};
 const source=new Element('button'),status=new Element('p');status.textContent='동기화 완료';
 const dialog=openUnifiedSettings({sourceButton:source,storage,preferenceStorage,status,openLogin:()=>{},renderAccountManagement:()=>{},logout:async()=>{},...options});
 return {dialog,source,button:text=>dialog.querySelectorAll('button').find(b=>b.textContent===text),restore:()=>{globalThis.document=previous;}};
}
test('settings defaults to display; week-start segments select correctly and reopening defaults to display',()=>{
 const f=fixture();try{assert.match(f.dialog.textContent,/달력 시작 요일/);assert.equal(f.button('일요일').attrs['aria-pressed'],'true');f.button('월요일').click();assert.equal(f.button('월요일').attrs['aria-pressed'],'true');assert.equal(f.button('일요일').attrs['aria-pressed'],'false');f.button('PACE 정보').click();assert.match(f.dialog.textContent,/버전 0.1.0/);f.dialog.close();assert.equal(f.source.attrs['aria-expanded'],'false');}finally{f.restore();}
 const reopened=fixture();try{assert.match(reopened.dialog.textContent,/달력 시작 요일/);}finally{reopened.restore();}
});
test('backup controls stay inside settings and require validated file and consent, with no reset action',()=>{
 const f=fixture();try{f.button('데이터 관리').click();assert.equal(f.dialog.open,true);assert.match(f.dialog.textContent,/pace\.\*/);assert.ok(f.button('JSON 파일 선택'));assert.ok(f.button('백업 다운로드'));assert.equal(f.button('백업 가져오기').disabled,true);assert.equal(f.button('데이터 초기화'),undefined);assert.equal(f.dialog.querySelectorAll('dialog').length,0);f.button('선택 취소').click();assert.equal(f.button('백업 가져오기').disabled,true);}finally{f.restore();}
});
test('signed-in account initial menu, account detail and back preserve the left menu and actual status',()=>{
 let renders=0;const f=fixture({initialMenu:'account',user:{email:'virtual@example.invalid'},renderAccountManagement:mount=>{renders++;const p=new Element('p');p.textContent='mock account management';mount.append(p);}});
 try{assert.match(f.dialog.textContent,/virtual@example.invalid/);assert.match(f.dialog.textContent,/동기화 완료/);f.button('계정 관리').click();assert.equal(renders,1);assert.ok(f.button('화면'));assert.match(f.dialog.textContent,/mock account/);f.button('← 계정으로 돌아가기').click();assert.ok(f.button('계정 관리'));assert.match(f.dialog.textContent,/동기화 완료/);}finally{f.restore();}
});
test('guest account shows no cloud status and closes settings before opening existing login',()=>{
 let login=0;const f=fixture({initialMenu:'account',openLogin:()=>login++});try{assert.match(f.dialog.textContent,/로그인하지 않은/);assert.doesNotMatch(f.dialog.textContent,/동기화 완료/);assert.equal(f.button('로그아웃'),undefined);f.button('로그인 / 회원가입').click();assert.equal(login,1);assert.equal(f.dialog.open,false);}finally{f.restore();}
});

function virtualBackup(){return JSON.stringify({format:'pace-local-backup',version:1,rawStorage:{'pace.certifications.v1':JSON.stringify([{id:'virtual',name:'가상 자격증',color:'#7863cf',examDate:'2030-12-01'}]),[STUDY_KEY]:JSON.stringify({...emptyStudy(),catalog:[{id:'virtual-item',planId:'virtual',title:'가상 학습',category:'테스트',type:'book',expectedMinutes:30}]})}});}
test('embedded selection cancel clears validated preview and consent without touching stored data',async()=>{
 const f=fixture({initialMenu:'data'});try{
  assert.equal(f.button('선택 취소').hidden,true);
  const file=f.dialog.querySelectorAll('input').find(x=>x.type==='file');
  file.files=[{name:'virtual.json',size:100,text:async()=>virtualBackup()}];await file.onchange();
  assert.match(f.dialog.textContent,/자격증 1개 · 학습 항목 1개/);assert.equal(f.button('선택 취소').hidden,false);assert.equal(f.button('백업 가져오기').disabled,true);
  const consent=f.dialog.querySelectorAll('input').find(x=>x.type==='checkbox');consent.checked=true;consent.onchange();assert.equal(f.button('백업 가져오기').disabled,false);
  f.button('선택 취소').click();assert.equal(f.button('선택 취소').hidden,true);assert.equal(f.button('백업 가져오기').disabled,true);assert.doesNotMatch(f.dialog.textContent,/검증 완료|자격증 1개/);assert.equal(f.dialog.querySelectorAll('input').find(x=>x.type==='checkbox').checked,undefined);
 }finally{f.restore();}
});
test('invalid file can be cancelled while import stays disabled',async()=>{
 const f=fixture({initialMenu:'data'});try{const file=f.dialog.querySelectorAll('input').find(x=>x.type==='file');file.files=[{name:'invalid.json',size:3,text:async()=>'bad'}];await file.onchange();assert.match(f.dialog.textContent,/올바른 JSON/);assert.equal(f.button('선택 취소').hidden,false);assert.equal(f.button('백업 가져오기').disabled,true);f.button('선택 취소').click();assert.doesNotMatch(f.dialog.textContent,/올바른 JSON/);}finally{f.restore();}
});

test('guest reset confirmation cancellation preserves data and does not refresh',()=>{const f=fixture();let refreshed=0;try{const storage={getItem:()=>null,removeItem:()=>assert.fail('cancel must not delete'),setItem:()=>assert.fail('cancel must not write')};const dialog=openGuestReset({storage,onSuccess:()=>refreshed++});assert.match(dialog.textContent,/이 브라우저의 학습 데이터가 삭제되며, 복구할 수 없습니다/);dialog.querySelectorAll('button').find(b=>b.textContent==='취소').click();assert.equal(dialog.open,false);assert.equal(refreshed,0);}finally{f.restore();}});
test('successful synthetic guest reset invokes screen refresh callback',()=>{const f=fixture();let refreshed=0;try{const map=new Map([['pace.study-plans.v1','virtual']]);const storage={getItem:k=>map.get(k)??null,removeItem:k=>map.delete(k),setItem:(k,v)=>map.set(k,v)};const dialog=openGuestReset({storage,onSuccess:()=>refreshed++});const apply=dialog.querySelectorAll('button').find(b=>b.textContent==='초기화'),consent=dialog.querySelectorAll('input')[0];assert.equal(apply.disabled,true);apply.onclick();assert.equal(map.size,1);consent.checked=true;consent.onchange();assert.equal(apply.disabled,false);apply.click();assert.equal(map.size,0);assert.equal(dialog.open,false);assert.equal(refreshed,1);}finally{f.restore();}});

test('reopening guest reset starts with unchecked consent and disabled reset',()=>{const f=fixture();try{const storage={getItem:()=>null};const first=openGuestReset({storage,onSuccess:()=>{}});const check=first.querySelectorAll('input')[0];check.checked=true;check.onchange();first.close();const reopened=openGuestReset({storage,onSuccess:()=>{}});assert.equal(reopened.querySelectorAll('input')[0].checked,false);assert.equal(reopened.querySelectorAll('button').find(b=>b.textContent==='초기화').disabled,true);reopened.close();}finally{f.restore();}});

test('account detail rows retain original handlers and omit logout',()=>{const f=fixture();try{const actions=new Element('div');let calls=0;for(const name of ['로그아웃','동기화 다시 시도','로컬 기록을 계정으로 복사','비밀번호 변경']){const b=new Element('button');b.textContent=name;b.onclick=()=>calls++;actions.append(b);}arrangeAccountActions(actions);assert.deepEqual(actions.querySelectorAll('button').map(b=>b.textContent),['변경','가져오기','다시 시도']);assert.equal(actions.children.length,3);for(const b of actions.querySelectorAll('button'))b.click();assert.equal(calls,3);assert.doesNotMatch(actions.textContent,/로그아웃/);}finally{f.restore();}});

test('local copy confirmation displays supplied counts and cancel or close yields no consent',async()=>{const f=fixture();try{for(const method of ['cancel','close']){const result=confirmLocalCopy({items:12,completed:5});const d=document.body.querySelectorAll('dialog').find(x=>x.attrs['aria-label']==='로컬 기록 가져오기');assert.match(d.textContent,/학습 항목 12개 · 완료 기록 5개/);assert.match(d.textContent,/계정에 데이터가 있으면 복사하지 않습니다/);if(method==='cancel')d.querySelectorAll('button').find(b=>b.textContent==='취소').click();else d.close();assert.equal(await result,false);}}finally{f.restore();}});
test('local copy dialog accepts only explicit import click',async()=>{const f=fixture();try{const result=confirmLocalCopy({items:7,completed:2});const d=document.body.querySelectorAll('dialog').find(x=>x.attrs['aria-label']==='로컬 기록 가져오기');d.querySelectorAll('button').find(b=>b.textContent==='가져오기').click();assert.equal(await result,true);}finally{f.restore();}});

test('password modal cancels without request and clears values',()=>{const f=fixture();try{let calls=0;const d=openPasswordChange({changePassword:async()=>calls++});for(const input of d.querySelectorAll('input'))input.value='virtual';d.querySelectorAll('button').find(b=>b.textContent==='취소').click();assert.equal(calls,0);assert.ok(d.querySelectorAll('input').every(x=>x.value===''));assert.equal(d.open,false);}finally{f.restore();}});
test('password modal rejects short or mismatched passwords without changing data',async()=>{const f=fixture();try{let calls=0;const d=openPasswordChange({changePassword:async()=>calls++}),form=d.querySelectorAll('form')[0],inputs=d.querySelectorAll('input');form.reportValidity=()=>true;inputs[0].value='virtual-current';inputs[1].value='short';inputs[2].value='short';await form.onsubmit({preventDefault(){}});assert.match(d.textContent,/8자 이상 입력/);inputs[1].value='virtual-new';inputs[2].value='different';await form.onsubmit({preventDefault(){}});assert.match(d.textContent,/일치하지/);assert.equal(inputs[2].parentElement.querySelectorAll('span')[0].textContent,'비밀번호가 일치하지 않습니다.');assert.equal(calls,0);}finally{f.restore();}});
test('password modal prevents duplicate submit and clears credentials after success or error',async()=>{const f=fixture();try{for(const fail of [false,true]){let calls=0,finish;const d=openPasswordChange({changePassword:async()=>{calls++;await new Promise(resolve=>finish=resolve);if(fail)throw {code:'invalid_credentials'};}}),form=d.querySelectorAll('form')[0],inputs=d.querySelectorAll('input');form.reportValidity=()=>true;inputs[0].value='virtual-current';inputs[1].value=inputs[2].value='virtual-new';const first=form.onsubmit({preventDefault(){}});await form.onsubmit({preventDefault(){}});assert.equal(calls,1);assert.equal(d.querySelectorAll('button').find(b=>b.textContent==='변경하기').disabled,true);finish();await first;assert.ok(inputs.every(x=>x.value===''));assert.match(d.textContent,fail?/현재 비밀번호를 확인/:/비밀번호를 변경했습니다/);d.close();}}finally{f.restore();}});

test('account reset cancel and unchecked execution never invoke reset',async()=>{const f=fixture();try{let calls=0;const d=openAccountReset({reset:async()=>calls++,onSuccess:()=>assert.fail('cancel')});const apply=d.querySelectorAll('button').find(b=>b.textContent==='초기화');assert.equal(apply.disabled,true);await apply.onclick();assert.equal(calls,0);d.querySelectorAll('button').find(b=>b.textContent==='취소').click();assert.equal(d.open,false);}finally{f.restore();}});
test('account reset modal prevents duplicate requests, reports failure and clears consent',async()=>{const f=fixture();try{let calls=0,finish;const d=openAccountReset({reset:async()=>{calls++;await new Promise(resolve=>finish=resolve);throw Error('virtual failure');},onSuccess:()=>assert.fail('failure is not success')}),check=d.querySelectorAll('input')[0],apply=d.querySelectorAll('button').find(b=>b.textContent==='초기화');check.checked=true;check.onchange();const pending=apply.onclick();await apply.onclick();assert.equal(calls,1);finish();await pending;assert.match(d.textContent,/virtual failure/);assert.equal(check.checked,false);assert.equal(apply.disabled,true);d.close();const reopened=openAccountReset({reset:async()=>{},onSuccess:()=>{}});assert.equal(reopened.querySelectorAll('input')[0].checked,false);reopened.close();}finally{f.restore();}});
test('account reset modal refreshes only after confirmed successful server operation',async()=>{const f=fixture();try{let refresh=0;const d=openAccountReset({reset:async options=>assert.equal(options.confirmed,true),onSuccess:()=>refresh++}),check=d.querySelectorAll('input')[0];check.checked=true;check.onchange();await d.querySelectorAll('button').find(b=>b.textContent==='초기화').onclick();assert.equal(refresh,1);assert.equal(d.open,false);}finally{f.restore();}});

test('theme segments default to system and switch independently of calendar start',()=>{const f=fixture();try{assert.equal(f.button('시스템 설정').attrs['aria-pressed'],'true');f.button('월요일').click();f.button('다크').click();assert.equal(f.button('다크').attrs['aria-pressed'],'true');assert.equal(f.button('월요일').attrs['aria-pressed'],'true');f.button('라이트').click();assert.equal(f.button('다크').attrs['aria-pressed'],'false');assert.equal(f.button('라이트').attrs['aria-pressed'],'true');f.button('시스템 설정').click();assert.equal(f.button('시스템 설정').attrs['aria-pressed'],'true');}finally{f.restore();}});
