import { useEffect, useMemo, useRef, useState } from 'react';
import { toDayKey, startOfMonth, monthLabel, formatTime, buildMonthCells } from './calendarUtils.js';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function PatientMiniCalendar({ loadRange, reloadKey, onCancel }) {
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
    <div className="mini-cal-wrap">
      <div className="mini-cal-toolbar">
        <button type="button" className="cal-nav-btn mini" onClick={() => go(-1)} aria-label="Previous month">‹</button>
        <strong className="mini-cal-month">{monthLabel(cursor)}</strong>
        <button type="button" className="cal-nav-btn mini" onClick={() => go(1)} aria-label="Next month">›</button>
        <button
          type="button"
          className="cal-today mini"
          onClick={() => { setSelectedKey(null); setCursor(startOfMonth(new Date())); }}
        >
          Today
        </button>
        {loading && <span className="muted">Loading…</span>}
      </div>

      {loadError && (
        <p className="message error" role="alert">
          {loadError}{' '}
          <button type="button" className="cal-today mini" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </p>
      )}

      <div className="mini-cal-grid" role="grid" aria-label={`My appointments for ${monthLabel(cursor)}`}>
        {WEEKDAYS.map((w, i) => (
          <div key={`${w}-${i}`} className="mini-cal-weekday">{w}</div>
        ))}
        {cells.map((cell) => {
          const hasAny = (byDay.get(cell.key) || []).length > 0;
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              onClick={() => setSelectedKey(cell.key)}
              className={[
                'mini-cal-day',
                cell.inMonth ? '' : 'out',
                cell.key === todayKey ? 'today' : '',
                hasAny ? 'has-appts' : '',
                cell.key === selectedKey ? 'selected' : '',
              ].join(' ').trim()}
              title={hasAny ? 'Show my appointments on this day' : 'No appointments on this day'}
            >
              {cell.date.getDate()}
              {hasAny && <i className="mini-cal-dot" />}
            </button>
          );
        })}
      </div>

      {!loading && monthAppointments.length === 0 && !loadError && (
        <p className="muted">No appointments this month.</p>
      )}

      {selectedKey && (
        <div className="mini-cal-details">
          <strong className="mini-cal-details-title">
            {new Date(`${selectedKey}T12:00:00`).toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </strong>
          {selectedList.length === 0
            ? <p className="muted">No appointments on this day.</p>
            : selectedList.map((a) => (
              <div className="user-row" key={a.id}>
                <span className="who">
                  {formatTime(a.appointment_date)} · {a.doctor_name || ''} @ {a.clinic_name || ''}
                  <br />
                  <span className={`cal-status ${a.status}`}>{a.status}</span>
                  {a.reason ? ` · ${a.reason}` : ''}
                </span>
                {onCancel && (
                  <button type="button" disabled={a.status === 'cancelled'} onClick={() => onCancel(a.id)}>
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
