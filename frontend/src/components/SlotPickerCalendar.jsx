import { useEffect, useMemo, useRef, useState } from 'react';
import { api, readError } from '../api/client.js';
import { toDayKey, startOfMonth, monthLabel, buildMonthCells } from './calendarUtils.js';
import { BTN_GHOST } from './ui.js';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function slotTime(startsAt) {
  return new Date(startsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function SlotPickerCalendar({ token, clinicId, doctorId, selectedSlotId, onSelect }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedKey, setSelectedKey] = useState(null);
  const [monthSlots, setMonthSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const cacheRef = useRef(new Map());
  const requestIdRef = useRef(0);

  const scopeKey = `${clinicId}|${doctorId}`;
  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);

  const range = useMemo(() => {
    const from = new Date(cells[0].date.getFullYear(), cells[0].date.getMonth(), cells[0].date.getDate()).toISOString();
    const lastDay = cells[cells.length - 1].date;
    const to = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1).toISOString();
    return { from, to };
  }, [cells]);
  const rangeKey = `${scopeKey}|${range.from}|${range.to}|${retryCount}`;

  useEffect(() => {
    if (!clinicId || !doctorId) {
      setMonthSlots([]);
      setLoading(false);
      return;
    }
    const cached = cacheRef.current.get(rangeKey);
    if (cached) {
      setMonthSlots(cached);
      setLoading(false);
      setLoadError('');
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setLoadError('');
    let cancelled = false;
    api.availability(token, {
      clinic_id: clinicId,
      doctor_id: doctorId,
      status: 'open',
      from: range.from,
      to: range.to,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, 'Loading open slots failed.'));
        return res.json();
      })
      .then((data) => {
        const rows = (data.slots || []).filter((s) => new Date(s.starts_at).getTime() > Date.now());
        cacheRef.current.set(rangeKey, rows);
        if (!cancelled && requestIdRef.current === requestId) {
          setMonthSlots(rows);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled && requestIdRef.current === requestId) {
          setLoadError(err && err.message ? err.message : 'Loading open slots failed.');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [rangeKey, token, clinicId, doctorId, range]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const s of monthSlots || []) {
      const key = toDayKey(s.starts_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    }
    return map;
  }, [monthSlots]);

  const go = (delta) => {
    setSelectedKey(null);
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  const todayKey = toDayKey(new Date());
  const selectedList = selectedKey ? byDay.get(selectedKey) || [] : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${BTN_GHOST} h-8 w-8 shrink-0 p-0 text-lg leading-none`} onClick={() => go(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong className="min-w-[110px] flex-1 text-center font-display text-[0.92rem] font-bold tracking-[-0.02em] text-[var(--color-ink)] sm:min-w-[132px] sm:flex-none sm:text-[0.98rem]">{monthLabel(cursor)}</strong>
        <button type="button" className={`${BTN_GHOST} h-8 w-8 shrink-0 p-0 text-lg leading-none`} onClick={() => go(1)} aria-label="Next month">
          ›
        </button>
        <button
          type="button"
          className={`${BTN_GHOST} ml-auto px-3.5 py-1.5 text-[0.72rem]`}
          onClick={() => { setSelectedKey(null); setCursor(startOfMonth(new Date())); }}
        >
          Today
        </button>
        {loading && <span className="text-[0.72rem] font-medium text-[var(--color-ink-soft)]">Loading…</span>}
      </div>

      {loadError && (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-[16px] bg-[rgba(248,161,136,0.16)] px-3 py-2 text-center text-[0.82rem] font-medium text-[#a8442d]" role="alert">
          {loadError}
          <button type="button" className={`${BTN_GHOST} px-3 py-1 text-[0.72rem]`} onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1" role="grid" aria-label={`Open slots for ${monthLabel(cursor)}`}>
        {WEEKDAYS.map((w, i) => (
          <div key={`${w}-${i}`} className="py-0.5 text-center font-display text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[var(--color-ink-soft)]">{w}</div>
        ))}
        {cells.map((cell) => {
          const hasOpen = (byDay.get(cell.key) || []).length > 0;
          const selected = cell.key === selectedKey;
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              onClick={() => setSelectedKey(cell.key)}
              className={[
                'relative flex h-9 cursor-pointer items-center justify-center rounded-full text-[0.8rem] font-bold text-[var(--color-ink)] transition-colors',
                !cell.inMonth ? 'opacity-30' : 'hover:bg-white',
                cell.key === todayKey ? 'bg-[var(--color-ink)] text-white' : '',
                hasOpen && cell.key !== todayKey ? 'bg-white shadow-[var(--shadow-sm)]' : '',
                selected ? 'outline-2 outline-offset-1 outline-[var(--color-ink)]' : '',
              ].join(' ').trim()}
              title={hasOpen ? 'Show open times on this day' : 'No open slots on this day'}
            >
              {cell.date.getDate()}
              {hasOpen && <span className={`pointer-events-none absolute bottom-[4px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${cell.key === todayKey ? 'bg-[var(--color-mustard)]' : 'bg-[var(--color-ink)]'}`} />}
            </button>
          );
        })}
      </div>

      {!loading && monthSlots.length === 0 && !loadError && (
        <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">No open slots this month. Try another month or doctor.</p>
      )}

      {selectedKey && (
        <div className="mt-1 flex flex-col gap-2 rounded-[18px] bg-white p-3 shadow-[var(--shadow-sm)]">
          <strong className="px-1 pt-1 font-display text-[0.92rem] font-bold tracking-[-0.02em] text-[var(--color-ink)]">
            {new Date(`${selectedKey}T12:00:00`).toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
            {' '}· 45 min each
          </strong>
          {selectedList.length === 0
            ? <p className="px-1 pb-1 text-[0.82rem] font-medium text-[var(--color-ink-soft)]">No open slots on this day.</p>
            : (
              <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                {selectedList.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelect(s)}
                    className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[0.8rem] font-bold transition-colors ${selectedSlotId === s.id ? 'bg-[var(--color-ink)] text-white shadow-[var(--shadow-sm)]' : 'bg-[var(--color-sand)] text-[var(--color-ink)] hover:bg-[var(--color-sand-deep)]'}`}
                    aria-pressed={selectedSlotId === s.id}
                  >
                    {slotTime(s.starts_at)}
                  </button>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
