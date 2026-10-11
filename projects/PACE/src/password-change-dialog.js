export function openPasswordChange({changePassword}){
 const dialog=document.createElement('dialog');dialog.className='guest-reset-dialog password-change-dialog';dialog.setAttribute('aria-label','비밀번호 변경');
 const head=document.createElement('div');head.className='local-copy-heading';const title=document.createElement('h2');title.textContent='비밀번호 변경';const close=document.createElement('button');close.type='button';close.className='icon-button';close.textContent='×';close.setAttribute('aria-label','비밀번호 변경 닫기');head.append(title,close);
 const form=document.createElement('form');const fields=['현재 비밀번호','새 비밀번호 (8자 이상)','새 비밀번호 확인'].map((text,i)=>{const input=document.createElement('input');input.type='password';input.required=true;input.autocomplete=i?'new-password':'current-password';if(i)input.minLength=8;const label=document.createElement('label');label.append(text,input);form.append(label);return input;});
 const errors=fields.map(input=>{const error=document.createElement('span');error.className='password-field-error';error.setAttribute('role','status');input.parentElement.append(error);return error;});
 const validate=()=>{errors.forEach(error=>error.textContent='');if(fields[1].value.length<8){errors[1].textContent='비밀번호는 8자 이상 입력해 주세요.';return false;}if(fields[1].value!==fields[2].value){errors[2].textContent='비밀번호가 일치하지 않습니다.';return false;}return true;};
 fields.slice(1).forEach(input=>input.addEventListener('input',()=>{if(errors.some(error=>error.textContent))validate();}));
 const message=document.createElement('p');message.setAttribute('role','status');const actions=document.createElement('div');actions.className='guest-reset-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';const submit=document.createElement('button');submit.type='submit';submit.textContent='변경하기';submit.className='local-copy-primary';actions.append(cancel,submit);form.append(message,actions);dialog.append(head,form);
 let busy=false;const clear=()=>{fields.forEach(input=>input.value='');errors.forEach(error=>error.textContent='');};close.onclick=cancel.onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',()=>{clear();dialog.remove();},{once:true});
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;message.textContent='';if(!validate()||!form.reportValidity())return;
 busy=true;submit.disabled=cancel.disabled=close.disabled=true;fields.forEach(input=>input.disabled=true);
 try{await changePassword(fields[0].value,fields[1].value);message.textContent='비밀번호를 변경했습니다.';}
 catch(error){if(error.code==='invalid_credentials')errors[0].textContent='현재 비밀번호를 확인해 주세요.';else message.textContent='변경 실패: '+(error.message||'네트워크 상태를 확인해 주세요.');}
 finally{fields.forEach(input=>input.value='');busy=false;submit.disabled=cancel.disabled=close.disabled=false;fields.forEach(input=>input.disabled=false);}
 };
 document.body.append(dialog);dialog.showModal();return dialog;
}
