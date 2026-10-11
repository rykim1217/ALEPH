export function openAccountReset({reset,onSuccess}){
 const dialog=document.createElement('dialog');dialog.className='guest-reset-dialog account-reset-dialog';dialog.setAttribute('aria-label','계정 데이터 초기화');
 const head=document.createElement('div');head.className='local-copy-heading';const title=document.createElement('h2');title.textContent='계정 데이터 초기화';const close=document.createElement('button');close.type='button';close.className='icon-button';close.textContent='×';close.setAttribute('aria-label','계정 데이터 초기화 닫기');head.append(title,close);dialog.append(head);
 const description=document.createElement('p');description.textContent='계정에 저장된 모든 학습 데이터와 개인 일정이 삭제되며, 복구할 수 없습니다.';
 const label=document.createElement('label'),consent=document.createElement('input');label.className='guest-reset-consent';consent.type='checkbox';consent.checked=false;label.append(consent,' 데이터 삭제에 동의합니다.');
 const message=document.createElement('p');message.setAttribute('role','status');const actions=document.createElement('div');actions.className='guest-reset-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';const apply=document.createElement('button');apply.type='button';apply.className='guest-reset-danger';apply.textContent='초기화';apply.disabled=true;let busy=false;
 consent.onchange=()=>apply.disabled=busy||!consent.checked;
 close.onclick=cancel.onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 apply.onclick=async()=>{if(busy||!consent.checked)return;busy=true;apply.disabled=cancel.disabled=close.disabled=consent.disabled=true;message.textContent='서버 반영을 확인하고 있습니다.';try{await reset({confirmed:consent.checked});message.textContent='계정 데이터를 초기화했습니다.';dialog.close();onSuccess();}catch(error){message.textContent=error.message;busy=false;cancel.disabled=close.disabled=false;consent.checked=false;consent.disabled=false;apply.disabled=true;}};
 actions.append(cancel,apply);dialog.append(description,label,message,actions);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();return dialog;
}
