const categoryNames={theory:'이론',programming:'프로그래밍',sql:'SQL'};
export function studyDisplayName(item){
 const category=categoryNames[item.category]||item.category||'';
 if(item.studyKind==='past'&&item.year!=null&&item.round!=null)return `${category} ${item.year}년 ${item.round}회`.trim();
 if(item.studyKind==='mock'&&item.round!=null)return `${category} ${item.round}회`.trim();
 if(item.number!=null&&String(item.number).trim())return `${category} ${item.number}`.trim();
 return item.title||'';
}
export function studyFullTitle(item){
 const category=categoryNames[item.category]||item.category||'';
 return item.number!=null&&String(item.number).trim()?[category,item.number,item.title].filter(Boolean).join(' '):item.title||'';
}

export function initStudyTooltips(root=document){
 const tooltip=document.createElement('div');tooltip.className='study-title-tooltip';tooltip.id='study-title-tooltip';tooltip.setAttribute('role','tooltip');tooltip.setAttribute('popover','manual');tooltip.hidden=true;document.body.append(tooltip);let timer,owner;
 const hide=()=>{clearTimeout(timer);if(tooltip.matches(':popover-open'))tooltip.hidePopover();tooltip.hidden=true;owner?.removeAttribute('aria-describedby');owner=null;};
 root.addEventListener('pointerover',event=>{const target=event.target.closest?.('[data-study-full-title]');if(!target||target===owner)return;hide();owner=target;timer=setTimeout(()=>{if(!owner?.isConnected)return;tooltip.textContent=owner.dataset.studyFullTitle;tooltip.hidden=false;tooltip.showPopover();owner.setAttribute('aria-describedby',tooltip.id);const rect=owner.getBoundingClientRect(),tip=tooltip.getBoundingClientRect();tooltip.style.left=Math.max(8,Math.min(rect.left,innerWidth-tip.width-8))+'px';tooltip.style.top=(rect.bottom+8+tip.height<=innerHeight-8?rect.bottom+8:Math.max(8,rect.top-tip.height-8))+'px';},250);});
 root.addEventListener('pointerout',event=>{if(owner&&event.target.closest?.('[data-study-full-title]')===owner&&!owner.contains(event.relatedTarget))hide();});
 root.addEventListener('pointerdown',hide);root.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
}
