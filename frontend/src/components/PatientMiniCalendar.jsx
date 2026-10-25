import { useEffect, useMemo, useRef, useState } from 'react';
import { toDayKey, startOfMonth, monthLabel, formatTime, buildMonthCells } from './calendarUtils.js';
import { BTN_INK, BTN_GHOST, statusPill } from './ui.js';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function PatientMiniCalendar({ loadRange, reloadKey, onCancel, onPay }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedKey, setSelectedKey] = useState(null);
  const [monthAppointments, setMonthAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const cacheRef = useRef(new Map());
  const requestIdRef = useRef(0);
  const lastReloadKeyRef = useRef(reloadKey);

  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);

  const range = useMemo(() => {
    const from = new Date(cells[0].date.getFullYear(), cells[0].date.getMonth(), cells[0].date.getDate()).toISOString();
    const lastDay = cells[cells.length - 1].date;
    const to = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1).toISOString();
    return { from, to };
  }, [cells]);
  const rangeKey = `${range.from}|${range.to}`;

  useEffect(() => {
    if (lastReloadKeyRef.current !== `${reloadKey}|${retryCount}`) {
      lastReloadKeyRef.current = `${reloadKey}|${retryCount}`;
      cacheRef.current.delete(rangeKey);
    }
    const cached = cacheRef.current.get(rangeKey);
    if (cached) {
      setMonthAppointments(cached);
      setLoading(false);
      setLoadError('');
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setLoadError('');
    let cancelled = false;
    loadRange(range)
      .then((rows) => {
        cacheRef.current.set(rangeKey, rows || []);
        if (!cancelled && requestIdRef.current === requestId) {
          setMonthAppointments(rows || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled && requestIdRef.current === requestId) {
          setLoadError(err && err.message ? err.message : 'Loading this month failed.');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [rangeKey, reloadKey, retryCount, loadRange, range]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const a of monthAppointments || []) {
      if (!a.appointment_date) continue;
      const key = toDayKey(a.appointment_date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    for (const list of map.values()) {
      list.sort((x, y) => new Date(x.appointment_date) - new Date(y.appointment_date));
    }
    return map;
  }, [monthAppointments]);

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

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1" role="grid" aria-label={`My appointments for ${monthLabel(cursor)}`}>
        {WEEKDAYS.map((w, i) => (
          <div key={`${w}-${i}`} className="py-0.5 text-center font-display text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[var(--color-ink-soft)]">{w}</div>
        ))}
        {cells.map((cell) => {
          const hasAny = (byDay.get(cell.key) || []).length > 0;
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
                hasAny && cell.key !== todayKey ? 'bg-white shadow-[var(--shadow-sm)]' : '',
                selected ? 'outline-2 outline-offset-1 outline-[var(--color-ink)]' : '',
              ].join(' ').trim()}
              title={hasAny ? 'Show my appointments on this day' : 'No appointments on this day'}
            >
              {cell.date.getDate()}
              {hasAny && <span className={`pointer-events-none absolute bottom-[4px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${cell.key === todayKey ? 'bg-[var(--color-mustard)]' : 'bg-[var(--color-ink)]'}`} />}
            </button>
          );
        })}
      </div>

      {!loading && monthAppointments.length === 0 && !loadError && (
        <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">No appointments this month.</p>
      )}

      {selectedKey && (
        <div className="mt-1 flex flex-col gap-1 rounded-[18px] bg-white p-3 shadow-[var(--shadow-sm)]">
          <strong className="px-1 pt-1 font-display text-[0.92rem] font-bold tracking-[-0.02em] text-[var(--color-ink)]">
            {new Date(`${selectedKey}T12:00:00`).toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </strong>
          {selectedList.length === 0
            ? <p className="px-1 pb-1 text-[0.82rem] font-medium text-[var(--color-ink-soft)]">No appointments on this day.</p>
            : selectedList.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2.5 border-t border-[var(--color-line)] px-1 py-3 text-sm first:border-t-0">
                <span className="min-w-0 flex-1 leading-[1.65] text-[var(--color-ink)]">
                  <span className="font-bold">{formatTime(a.appointment_date)}</span> · {a.doctor_name || ''} @ {a.clinic_name || ''}
                  <br />
                  <span className={statusPill(a.status)}>{a.status.replaceAll('_', ' ')}</span>
                  {a.reason ? <span className="text-[0.8rem] text-[var(--color-ink-soft)]"> · {a.reason}</span> : ''}
                  {a.status === 'awaiting_payment' && a.amount_due_cents ? (
                    <span className="block text-[0.78rem] font-medium text-[#8d6717]">
                      Pay EGP {(Number(a.amount_due_cents) / 100).toFixed(2)} to confirm
                    </span>
                  ) : ''}
                </span>
                {a.status === 'awaiting_payment' && onPay && (
                  <button type="button" className={`${BTN_INK} w-full px-3.5 py-1.5 text-xs sm:w-auto`} onClick={() => onPay(a)}>
                    Pay now
                  </button>
                )}
                {onCancel && (
                  <button type="button" disabled={a.status === 'cancelled'} className={`${BTN_INK} w-full px-3.5 py-1.5 text-xs sm:w-auto`} onClick={() => onCancel(a.id)}>
                    Cancel
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
