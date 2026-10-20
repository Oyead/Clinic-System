import { useEffect, useMemo, useRef, useState } from 'react';
import { toDayKey, startOfMonth, startOfDay, monthLabel, formatTime, buildMonthCells } from './calendarUtils.js';
import { SURFACE, MODAL_BACKDROP, BTN_GHOST, BTN_SUCCESS, BTN_DANGER, BTN_INK, statusPill } from './ui.js';

const ACTIVE_STATUSES = ['pending', 'scheduled'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ActiveCalendar({ loadRange, reloadKey, onDecide, onCancel }) {
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
    const from = startOfDay(cells[0].date).toISOString();
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

  const active = useMemo(
    () => (monthAppointments || []).filter((a) => ACTIVE_STATUSES.includes(a.status)),
    [monthAppointments],
  );

  const byDay = useMemo(() => {
    const map = new Map();
    for (const a of active) {
      if (!a.appointment_date) continue;
      const key = toDayKey(a.appointment_date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    for (const list of map.values()) {
      list.sort((x, y) => new Date(x.appointment_date) - new Date(y.appointment_date));
    }
    return map;
  }, [active]);

  useEffect(() => {
    if (selectedKey && !loading && !(byDay.get(selectedKey) || []).length) {
      setSelectedKey(null);
    }
  }, [selectedKey, byDay, loading]);

  const todayKey = toDayKey(new Date());
  const selectedList = selectedKey ? byDay.get(selectedKey) || [] : [];
  const totalActive = active.length;
  const pendingCount = active.filter((a) => a.status === 'pending').length;
  const scheduledCount = active.filter((a) => a.status === 'scheduled').length;

  const go = (delta) => {
    setSelectedKey(null);
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };
  const goToday = () => {
    setSelectedKey(null);
    setCursor(startOfMonth(new Date()));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button type="button" className={`${BTN_GHOST} h-9 w-9 p-0 text-lg leading-none`} onClick={() => go(-1)} aria-label="Previous month">
            ‹
          </button>
          <strong className="min-w-[96px] text-center font-display text-[0.98rem] font-bold tracking-[-0.02em] text-[var(--color-ink)] sm:min-w-[150px] sm:text-[1.1rem]">{monthLabel(cursor)}</strong>
          <button type="button" className={`${BTN_GHOST} h-9 w-9 p-0 text-lg leading-none`} onClick={() => go(1)} aria-label="Next month">
            ›
          </button>
          <button type="button" className={`${BTN_GHOST} ml-auto px-4 py-1.5 text-[0.76rem]`} onClick={goToday}>
            Today
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[0.76rem] font-medium text-[var(--color-ink-soft)]" aria-label="Active counts">
          {loading
            ? <span>Loading this month…</span>
            : (
              <>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-ink)]" />{totalActive} active</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-amber-dark)]" />{pendingCount} pending</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-mint-dark)]" />{scheduledCount} scheduled</span>
              </>
            )}
        </div>
      </div>

      {loadError && (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-[18px] bg-[rgba(248,161,136,0.16)] px-4 py-3 text-center text-[0.85rem] font-medium text-[#a8442d]" role="alert">
          {loadError}
          <button type="button" className={`${BTN_GHOST} px-3.5 py-1.5 text-[0.76rem]`} onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-7 gap-0.5 sm:gap-2" role="grid" aria-label={`Active appointments for ${monthLabel(cursor)}`}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center font-display text-[0.56rem] font-bold uppercase tracking-[0.08em] text-[var(--color-ink-soft)] sm:text-[0.64rem] sm:tracking-[0.12em]">{w}</div>
        ))}
        {cells.map((cell) => {
          const list = byDay.get(cell.key) || [];
          const hasActive = list.length > 0;
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedKey;
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              disabled={!hasActive}
              onClick={() => hasActive && setSelectedKey(cell.key)}
              className={[
                'flex min-h-[64px] flex-col items-start gap-1 rounded-[12px] p-0.5 text-left text-[var(--color-ink)] transition-colors sm:min-h-[104px] sm:gap-1.5 sm:rounded-[16px] sm:p-2.5',
                hasActive ? 'cursor-pointer bg-white shadow-[var(--shadow-sm)] hover:bg-[#fffdf9]' : 'cursor-default bg-white/45',
                !cell.inMonth ? 'opacity-45' : '',
                isSelected ? 'outline-2 outline-offset-2 outline-[var(--color-ink)]' : '',
              ].join(' ').trim()}
              title={hasActive ? `${list.length} active appointment(s) - open details` : 'No active appointments'}
            >
              <span className={[
                'flex h-6 min-w-6 items-center justify-center rounded-full px-0.5 font-display text-[0.7rem] font-bold sm:h-7 sm:min-w-7 sm:px-1 sm:text-[0.82rem]',
                isToday ? 'bg-[var(--color-ink)] text-white' : hasActive ? 'bg-[var(--color-sand)] text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]',
              ].join(' ').trim()}>
                {cell.date.getDate()}
              </span>
              {hasActive && (
                <>
                  <span className="hidden text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[var(--color-ink-soft)] sm:inline-flex">
                    {list.length} active
                  </span>
                  <span className="hidden w-full flex-col gap-1 sm:flex">
                    {list.slice(0, 2).map((a) => (
                      <span key={a.id} className="flex w-full items-center gap-1 overflow-hidden rounded-full bg-[var(--color-sand)] px-2 py-0.5 text-[0.68rem] leading-[1.4] text-[var(--color-ink)]">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.status === 'pending' ? 'bg-[var(--color-amber-dark)]' : 'bg-[var(--color-mint-dark)]'}`} />
                        <span className="truncate"><b>{formatTime(a.appointment_date)}</b> {a.patient_name || `#${a.id}`}</span>
                      </span>
                    ))}
                    {list.length > 2 && (
                      <span className="text-[0.66rem] font-bold text-[var(--color-ink-soft)]">+{list.length - 2} more</span>
                    )}
                  </span>
                  <span className="mt-auto flex w-full justify-center gap-1 sm:hidden">
                    {list.slice(0, 3).map((a) => (
                      <span key={a.id} className={`h-1.5 w-1.5 rounded-full ${a.status === 'pending' ? 'bg-[var(--color-amber-dark)]' : 'bg-[var(--color-mint-dark)]'}`} />
                    ))}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {!loading && totalActive === 0 && !loadError && (
        <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">No active appointments this month.</p>
      )}

      {selectedKey && (
        <div className={MODAL_BACKDROP} onClick={() => setSelectedKey(null)}>
          <div
            className={`${SURFACE} w-full max-w-[640px] p-6 sm:p-8`}
            role="dialog"
            aria-modal="true"
            aria-label={`Appointments on ${selectedKey}`}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[0.66rem] font-bold uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">Active calendar</span>
            <h2 className="mt-1.5 font-display text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-[var(--color-ink)]">
              {new Date(`${selectedKey}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </h2>
            <p className="mt-1 text-[0.85rem] text-[var(--color-ink-soft)]">
              {selectedList.length} active appointment{selectedList.length === 1 ? '' : 's'} - review, approve, reject or cancel.
            </p>
            <div className="mt-4 flex max-h-[46vh] flex-col divide-y divide-[var(--color-line)] overflow-auto rounded-[18px] bg-[var(--color-sand)] px-4 py-1">
              {selectedList.map((a) => (
                <div key={a.id} className="grid gap-3 py-4 text-sm sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                  <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start sm:gap-1.5">
                    <span className="font-display text-[0.95rem] font-bold leading-none text-[var(--color-ink)]">{formatTime(a.appointment_date)}</span>
                    <span className={statusPill(a.status)}>{a.status.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    <p className="leading-[1.55] text-[var(--color-ink)]">
                      <span className="font-bold">#{a.id}</span> {a.patient_name || 'Patient'} <span className="text-[var(--color-ink-soft)]">→</span> {a.doctor_name || 'Doctor'}
                    </p>
                    <p className="mt-1 text-[0.8rem] leading-[1.5] text-[var(--color-ink-soft)]">
                      {a.clinic_name || 'Clinic'}{a.reason ? ` · ${a.reason}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {a.status === 'pending' && onDecide && (
                      <>
                        <button type="button" className={`${BTN_SUCCESS} flex-1 px-3.5 py-1.5 text-xs sm:flex-none`} onClick={() => onDecide(a.id, 'approve')}>
                          Approve
                        </button>
                        <button type="button" className={`${BTN_DANGER} flex-1 px-3.5 py-1.5 text-xs sm:flex-none`} onClick={() => onDecide(a.id, 'reject')}>
                          Reject
                        </button>
                      </>
                    )}
                    {(a.status === 'pending' || a.status === 'scheduled') && onCancel && (
                      <button type="button" className={`${BTN_INK} flex-1 px-3.5 py-1.5 text-xs sm:flex-none`} onClick={() => onCancel(a.id)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" className={`${BTN_INK} w-full px-7 py-2.5 text-sm sm:w-auto`} onClick={() => setSelectedKey(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
