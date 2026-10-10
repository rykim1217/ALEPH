export const palette = [
  ['보라', '#7C4DD4'], ['파랑', '#3889DB'], ['청록', '#249DA5'], ['초록', '#72AD45'],
  ['노랑', '#E9B83D'], ['주황', '#F39D31'], ['로즈', '#C7599E'], ['차콜', '#414752'],
];

export function shadesFor(color) {
  const gradients={
    '#7C4DD4':['#F3EAFC','#E4D2F8','#CEB1F0','#B38AE5','#7C4DD4','#7043C5','#6339B4','#5631A0'],
    '#3889DB':['#EAF3FE','#CDE4FC','#A5CFF8','#72B2EF','#3889DB','#2D7DCE','#266EBC','#205EA5'],
    '#249DA5':['#E6F7F7','#C4EEEE','#94DEDF','#5BC6CB','#249DA5','#1D909A','#18808C','#146E7D'],
    '#72AD45':['#F0F8E7','#DDEDC6','#C0DE9C','#9BC66D','#72AD45','#639D39','#548C30','#477A28'],
    '#E9B83D':['#FFF8DF','#FFF0B5','#FBE28A','#F4CE5B','#E9B83D','#DEA72E','#D09524','#BF821C'],
    '#F39D31':['#FFF3DF','#FBE0B2','#F8C978','#F5B34B','#F39D31','#EF902C','#E67A27','#D95F22'],
    '#C7599E':['#FCEAF5','#F4CDE5','#ECA9D2','#DC80BB','#C7599E','#B94B92','#A83E84','#953477'],
    '#414752':['#F1F3F5','#DBDFE4','#BDC4CE','#909BAA','#414752','#3B414D','#353B47','#303642'],
  };
  if(gradients[color.toUpperCase()])return [...gradients[color.toUpperCase()]];
  const rgb = color.slice(1).match(/../g).map(n => parseInt(n, 16));
  const mix = (target, weight) => '#' + rgb.map(n => Math.round(n + (target - n) * weight).toString(16).padStart(2, '0')).join('').toUpperCase();
  return [...[.78, .6, .4, .2].map(w => mix(255, w)), color.toUpperCase(), ...[.1, .2, .3].map(w => mix(0, w))];
}
export function isExamLikeColor(color){const [r,g,b]=color.slice(1).match(/../g).map(n=>parseInt(n,16));return r>g+50&&r>b+40&&b<=g+35;}
export function detailColors(base,current){const colors=shadesFor(base);const selected=isExamLikeColor(current)?base.toUpperCase():current.toUpperCase();if(!colors.includes(selected)){const rgb=c=>c.slice(1).match(/../g).map(n=>parseInt(n,16));const target=rgb(selected);const distance=c=>rgb(c).reduce((sum,n,i)=>sum+(n-target[i])**2,0);let nearest=0;colors.forEach((c,i)=>{if(distance(c)<distance(colors[nearest]))nearest=i;});colors[nearest]=selected;colors.sort((a,b)=>rgb(b).reduce((s,n)=>s+n,0)-rgb(a).reduce((s,n)=>s+n,0));}return colors;}
export function familyFor(color) {
  const hex = color.toUpperCase();
  const known = palette.findIndex(([, base]) => shadesFor(base).includes(hex));
  if (known >= 0) return known;
  const rgb = hex.slice(1).match(/../g).map(n => parseInt(n, 16));
  return palette.reduce((best, [, base], i) => {
    const distance = base.slice(1).match(/../g).reduce((sum, n, j) => sum + (parseInt(n, 16) - rgb[j]) ** 2, 0);
    return distance < best.distance ? { index: i, distance } : best;
  }, { index: 0, distance: Infinity }).index;
}

export function initColorPalette(form, root, {sharedActions=false,onDraftChange=()=>{}}={}) {
  const input = form.elements.color;
  let current, draft, active, detail = false;
  const card = document.createElement('section'); card.className = 'palette-card'; card.setAttribute('aria-label', '색상 선택');
  const header = document.createElement('div'); header.className = 'palette-header';
  const title = document.createElement('strong'); title.textContent = '색상 선택';
  const back = document.createElement('button'); back.type = 'button'; back.className = 'palette-back'; back.textContent = '←'; back.setAttribute('aria-label', '기본 팔레트로 돌아가기'); header.append(back, title);
  const buttons = document.createElement('div'); buttons.className = 'color-swatches'; buttons.setAttribute('role', 'group');
  const hint = document.createElement('small');
  const actions = document.createElement('div'); actions.className = 'certification-actions';actions.hidden=sharedActions;
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '취소';
  const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = '확인'; actions.append(cancel, confirm); card.append(header, buttons, hint, actions); root.append(card);
  function render() {
    onDraftChange(draft);
    back.hidden = !detail; title.textContent = detail ? `${palette[active][0]} · 세부 색상` : '색상 선택';
    hint.textContent = detail ? '밝고 어두운 색상을 선택한 뒤 확인을 눌러 주세요.' : '선택된 원을 다시 누르면 같은 계열의 세부 색상을 볼 수 있습니다.';
    buttons.setAttribute('aria-label', detail ? '세부 색상 팔레트' : '기본 색상 팔레트');
    let choices = detail ? shadesFor(palette[active][1]).map((color, i) => [`${palette[active][0]} 세부 색상 ${i + 1}`, color]) : palette.map(([name, color]) => [name, color]);

    buttons.replaceChildren(...choices.map(([name, color], i) => {
      const selected = detail ? draft === color : active === i;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'color-swatch'; button.style.backgroundColor = color;
      button.textContent = selected ? '✓' : ''; button.setAttribute('aria-label', name); button.setAttribute('aria-pressed', String(selected)); button.title = name;
      button.addEventListener('click', () => {
        if (detail) draft = color;
        else if (active === i) detail = true;
        else { active = i; draft = color; }
        render(); buttons.querySelector('[aria-pressed="true"]')?.focus();
      }); return button;
    }));
  }
  back.addEventListener('click', () => { detail = false; render(); buttons.children[active].focus(); });
  cancel.addEventListener('click', () => { draft = current; active = familyFor(current); detail = false; render(); buttons.children[active].focus(); });
  confirm.addEventListener('click', () => { current = draft; input.value = current; detail = false; render(); buttons.children[active].focus(); });
  card.addEventListener('keydown', event => { if (event.key === 'Escape' && detail) { event.preventDefault(); event.stopPropagation(); detail = false; render(); buttons.children[active].focus(); } });
  function sync() { current = input.value.toUpperCase(); draft = current; active = familyFor(current); detail = false; render(); }
  sync(); return { sync, getDraft:()=>draft };
}
