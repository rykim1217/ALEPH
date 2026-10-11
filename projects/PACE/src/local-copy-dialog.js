// Consent only: this dialog never reads or writes storage or calls Supabase.
export function confirmLocalCopy({items,completed}){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='guest-reset-dialog local-copy-dialog';dialog.setAttribute('aria-label','로컬 기록 가져오기');
  const head=document.createElement('div');head.className='local-copy-heading';const title=document.createElement('h2');title.textContent='로컬 기록 가져오기';const close=document.createElement('button');close.type='button';close.className='icon-button';close.setAttribute('aria-label','로컬 기록 가져오기 닫기');close.textContent='×';head.append(title,close);dialog.append(head);
  for(const [text,className] of [['이 브라우저의 학습 기록을 로그인 계정으로 복사합니다.',''],['학습 항목 '+items+'개 · 완료 기록 '+completed+'개','local-copy-counts'],['기존 로컬 기록은 유지되며, 계정에 데이터가 있으면 복사하지 않습니다.','']]){const p=document.createElement('p');p.textContent=text;p.className=className;dialog.append(p);}
  let accepted=false;const actions=document.createElement('div');actions.className='guest-reset-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';const apply=document.createElement('button');apply.type='button';apply.textContent='가져오기';apply.className='local-copy-primary';actions.append(cancel,apply);dialog.append(actions);
  close.onclick=cancel.onclick=()=>dialog.close();apply.onclick=()=>{accepted=true;dialog.close();};dialog.addEventListener('close',()=>{dialog.remove();resolve(accepted);},{once:true});document.body.append(dialog);dialog.showModal();
 });
}
