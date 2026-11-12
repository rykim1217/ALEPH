// Navigation and viewport presentation only; never reads or writes learning storage.
export function initResponsiveUI(){
 initTodayOverlayScroll();
 const sidebar=document.querySelector('.sidebar'),media=window.matchMedia('(max-width:720px)');
 const bar=document.createElement('header');bar.className='mobile-app-bar';bar.innerHTML='<a href="/" class="mobile-brand">✦ PACE</a><button type="button" aria-controls="pace-mobile-sidebar" aria-expanded="false">메뉴</button>';
 sidebar.id='pace-mobile-sidebar';const toggle=bar.querySelector('button'),shade=document.createElement('button');shade.className='mobile-menu-shade';shade.type='button';shade.setAttribute('aria-label','메뉴 닫기');shade.hidden=true;document.body.prepend(bar,shade);
 const close=document.createElement('button');close.type='button';close.className='mobile-menu-close';close.textContent='×';close.setAttribute('aria-label','메뉴 닫기');sidebar.prepend(close);
 const setOpen=open=>{const active=media.matches&&open;document.body.classList.toggle('mobile-menu-open',active);toggle.setAttribute('aria-expanded',String(active));shade.hidden=!active;sidebar.inert=media.matches&&!active;if(active)close.focus();else if(media.matches)toggle.focus();};
 toggle.onclick=()=>setOpen(toggle.getAttribute('aria-expanded')!=='true');close.onclick=shade.onclick=()=>setOpen(false);
 sidebar.addEventListener('click',event=>{if(media.matches&&event.target.closest('.nav-item'))setOpen(false);});
 sidebar.addEventListener('keydown',event=>{if(!media.matches)return;if(event.key==='Escape'){event.preventDefault();setOpen(false);}if(event.key==='Tab'){const controls=[...sidebar.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(e=>e.getClientRects().length);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
 const sync=()=>{sidebar.inert=media.matches&&!document.body.classList.contains('mobile-menu-open');if(!media.matches){document.body.classList.remove('mobile-menu-open');shade.hidden=true;toggle.setAttribute('aria-expanded','false');}};media.addEventListener?.('change',sync);sync();
 const viewport=()=>document.documentElement.style.setProperty('--usable-height',(window.visualViewport?.height||window.innerHeight)+'px');window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);viewport();
}

function initTodayOverlayScroll(){
 const list=document.getElementById('today-items');
 if(!list||list.dataset.overlayScroll)return;
 list.dataset.overlayScroll='true';
 const panel=list.closest('.today-card');
 if(!panel)return;
 panel.classList.add('today-overlay-panel');
 const thumb=document.createElement('div');
 thumb.className='today-overlay-thumb';thumb.setAttribute('aria-hidden','true');panel.append(thumb);
 let timer,drag=null,frame=0;
 const update=()=>{
  frame=0;
  const height=list.clientHeight,max=list.scrollHeight-height;
  const scrollable=max>1&&height>0&&getComputedStyle(list).overflowY!=='visible';
  thumb.hidden=!scrollable;
  if(!scrollable)return;
  const size=Math.min(height,Math.max(24,height*height/list.scrollHeight));
  const p=panel.getBoundingClientRect(),r=list.getBoundingClientRect();
  thumb.style.height=size+'px';
  thumb.style.left=(r.right-p.left-panel.clientLeft-6)+'px';
  thumb.style.top=(r.top-p.top-panel.clientTop+list.scrollTop/max*(height-size))+'px';
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 const reveal=()=>{thumb.classList.add('is-visible');clearTimeout(timer);if(!drag)timer=setTimeout(()=>thumb.classList.remove('is-visible'),900);schedule();};
 list.addEventListener('scroll',reveal,{passive:true});
 list.addEventListener('wheel',reveal,{passive:true});
 thumb.addEventListener('pointerdown',e=>{
  e.preventDefault();drag={y:e.clientY,top:list.scrollTop};thumb.setPointerCapture(e.pointerId);reveal();
 });
 thumb.addEventListener('pointermove',e=>{
  if(!drag)return;
  const travel=list.clientHeight-thumb.offsetHeight;
  if(travel>0)list.scrollTop=drag.top+(e.clientY-drag.y)*(list.scrollHeight-list.clientHeight)/travel;
 });
 const stop=()=>{drag=null;reveal();};
 thumb.addEventListener('pointerup',stop);thumb.addEventListener('pointercancel',stop);
 new ResizeObserver(schedule).observe(list);
 new ResizeObserver(schedule).observe(panel);
 new MutationObserver(schedule).observe(list,{childList:true,subtree:true,characterData:true});
 window.addEventListener('resize',schedule);schedule();
}
