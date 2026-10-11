// Explicit guest-only keys. Never use an account-scoped store here.
export const GUEST_RESET_KEYS=Object.freeze(['pace.certifications.v1','pace.study-plans.v1','pace.availability.v1','pace.availability.v2','pace.planning-settings.v1','pace.distribution-settings.v1','pace.personal-events.v1']);
export function guestSnapshot(storage){return JSON.stringify(GUEST_RESET_KEYS.map(key=>[key,storage.getItem(key)]));}
export function resetGuestData(storage,{confirmed=false,expectedSnapshot}={}){
 if(!confirmed)throw Error('초기화 확인이 필요합니다.');
 const snapshot=guestSnapshot(storage);if(snapshot!==expectedSnapshot)throw Error('게스트 데이터가 변경되었습니다. 확인창을 다시 열어 주세요.');
 const previous=JSON.parse(snapshot);
 try{for(const [key,value] of previous)if(value!==null)storage.removeItem(key);if(GUEST_RESET_KEYS.some(key=>storage.getItem(key)!==null))throw Error('삭제 결과 확인 실패');}
 catch(error){let failed=false;for(const [key,value] of previous){try{if(value!==null)storage.setItem(key,value);}catch{failed=true;}}
 throw Error(failed?'초기화와 일부 복원에 실패했습니다. 보관한 백업을 확인해 주세요.':'초기화에 실패하여 기존 게스트 데이터를 복원했습니다.');}
}
export function openGuestReset({storage,onSuccess}){
 const snapshot=guestSnapshot(storage),dialog=document.createElement('dialog');dialog.className='guest-reset-dialog';dialog.setAttribute('aria-label','로컬 데이터 초기화');
 const head=document.createElement('div');head.className='local-copy-heading';const title=document.createElement('h2');title.textContent='로컬 데이터 초기화';const close=document.createElement('button');close.type='button';close.className='icon-button';close.textContent='×';close.setAttribute('aria-label','로컬 데이터 초기화 닫기');close.onclick=()=>dialog.close();head.append(title,close);dialog.append(head);
 const description=document.createElement('p');description.textContent='이 브라우저의 학습 데이터가 삭제되며, 복구할 수 없습니다.';dialog.append(description);
 const label=document.createElement('label'),consent=document.createElement('input');label.className='guest-reset-consent';consent.type='checkbox';consent.checked=false;label.append(consent,' 데이터 삭제에 동의합니다.');dialog.append(label);
 const status=document.createElement('p');status.setAttribute('role','status');const actions=document.createElement('div');actions.className='guest-reset-actions';
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>dialog.close();
 const apply=document.createElement('button');apply.type='button';apply.textContent='초기화';apply.className='guest-reset-danger';apply.disabled=true;consent.onchange=()=>{apply.disabled=!consent.checked;};apply.onclick=()=>{if(!consent.checked)return;apply.disabled=true;try{resetGuestData(storage,{confirmed:consent.checked,expectedSnapshot:snapshot});dialog.close();onSuccess();}catch(error){status.textContent=error.message;apply.disabled=!consent.checked;}};
 actions.append(cancel,apply);dialog.append(status,actions);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();return dialog;
}
