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
