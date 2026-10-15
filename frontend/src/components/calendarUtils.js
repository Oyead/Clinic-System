export function toDayKey(dateInput) {
  const d = new Date(dateInput);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function monthLabel(date) {
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export function formatTime(dateInput) {
  return new Date(dateInput).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatFull(dateInput) {
  return new Date(dateInput).toLocaleString();
}

export function buildMonthCells(cursor) {
  const first = startOfMonth(cursor);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const daysInPrev = new Date(cursor.getFullYear(), cursor.getMonth(), 0).getDate();
  const out = [];
  for (let i = offset - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - 1, daysInPrev - i);
    out.push({ date: d, inMonth: false, key: toDayKey(d) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    out.push({ date, inMonth: true, key: toDayKey(date) });
  }
  while (out.length % 7 !== 0 || out.length < 35) {
    const last = out[out.length - 1].date;
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    out.push({ date: next, inMonth: next.getMonth() === cursor.getMonth(), key: toDayKey(next) });
    if (out.length >= 42) break;
  }
  return out;
}
