export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function monthCells(year, month) {
  const start = new Date(year, month, 1);
  const sundayOffset = start.getDay();
  const count = Math.ceil((sundayOffset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => new Date(year, month, 1 - sundayOffset + i));
}
export function shiftMonth(year, month, offset) {
  const date = new Date(year, month + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}
export function daysBetween(first, last) {
  return Math.round((Date.UTC(last.getFullYear(), last.getMonth(), last.getDate()) - Date.UTC(first.getFullYear(), first.getMonth(), first.getDate())) / 86400000);
}
export function formatMinutes(minutes) {
  return minutes === 0 ? '0시간' : [minutes >= 60 ? `${Math.floor(minutes / 60)}시간` : '', minutes % 60 ? `${minutes % 60}분` : ''].filter(Boolean).join(' ');
}

export function detailPlacement(cell,width,height,viewportWidth,viewportHeight) {
  const margin=16,gap=12,clamp=(v,max)=>Math.max(margin,Math.min(v,max-margin));
  if(viewportWidth<=720||height>viewportHeight-2*margin)return {fullscreen:true};
  const x=clamp(cell.left,viewportWidth-width),y=clamp(cell.bottom-height,viewportHeight-height);
  const above={x,y:cell.top-gap-height},below={x,y:cell.bottom+gap};
  const right={x:cell.right+gap,y},left={x:cell.left-gap-width,y};
  const options=cell.top>viewportHeight/2?[above,left,right,below]:[below,right,left,above];
  const fits=p=>p.x>=margin&&p.y>=margin&&p.x+width<=viewportWidth-margin&&p.y+height<=viewportHeight-margin;
  return options.find(fits)||{fullscreen:true};
}

export function attachedEditorPlacement(detail,cell,width,height,viewportWidth,viewportHeight) {
  const gap=10,margin=16;
  if(viewportWidth<=720)return {fullscreen:true};
  const overlaps=(p,r)=>p.x<r.right&&p.x+width>r.left&&p.y<r.bottom&&p.y+height>r.top;
  const ys=[detail.top,Math.max(margin,Math.min(detail.bottom-height,viewportHeight-height-margin)),cell.top-height-gap,cell.bottom+gap];
  for(const x of [detail.right+gap,detail.left-width-gap])for(const y of ys){const p={x,y};if(x>=margin&&y>=margin&&x+width<=viewportWidth-margin&&y+height<=viewportHeight-margin&&!overlaps(p,cell)&&!overlaps(p,detail))return p;}
  return {fullscreen:true};
}

export function datePickerPlacement(anchor,bounds,width,height,viewportWidth,viewportHeight) {
  const margin=12,gap=6;
  const below=bounds.bottom-anchor.bottom-gap,above=anchor.top-bounds.top-gap;
  const top=below>=height||below>=above?anchor.bottom+gap:anchor.top-height-gap;
  const left=Math.max(bounds.left+margin,Math.min(anchor.left,bounds.right-width-margin));
  return {x:Math.max(margin,Math.min(left,viewportWidth-width-margin)),y:Math.max(margin,Math.min(top,viewportHeight-height-margin))};
}
