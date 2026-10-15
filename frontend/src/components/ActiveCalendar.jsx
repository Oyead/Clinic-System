import { useEffect, useMemo, useRef, useState } from 'react';
import { toDayKey, startOfMonth, startOfDay, monthLabel, formatTime, formatFull, buildMonthCells } from './calendarUtils.js';

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
    <div className="cal-wrap">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="cal-nav-btn" onClick={() => go(-1)} aria-label="Previous month">
            ‹
          </button>
          <strong className="cal-month">{monthLabel(cursor)}</strong>
          <button type="button" className="cal-nav-btn" onClick={() => go(1)} aria-label="Next month">
            ›
          </button>
          <button type="button" className="cal-today" onClick={goToday}>
            Today
          </button>
        </div>
        <div className="cal-legend" aria-label="Active counts">
          {loading
            ? <span className="cal-count">Loading this month…</span>
            : (
              <>
                <span className="cal-count"><i className="dot dot-active" />{totalActive} active</span>
                <span className="cal-count"><i className="dot dot-pending" />{pendingCount} pending</span>
                <span className="cal-count"><i className="dot dot-scheduled" />{scheduledCount} scheduled</span>
              </>
            )}
        </div>
      </div>

      {loadError && (
        <p className="message error" role="alert">
          {loadError}{' '}
          <button type="button" className="cal-today" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </p>
      )}

      <div className="cal-grid" role="grid" aria-label={`Active appointments for ${monthLabel(cursor)}`}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday">{w}</div>
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
                'cal-day',
                cell.inMonth ? '' : 'out',
                isToday ? 'today' : '',
                hasActive ? 'has-active' : '',
                isSelected ? 'selected' : '',
              ].join(' ').trim()}
              title={hasActive ? `${list.length} active appointment(s) — open details` : 'No active appointments'}
            >
              <span className="cal-day-num">{cell.date.getDate()}</span>
              {hasActive && (
                <>
                  <span className="cal-badge">{list.length} active</span>
                  <span className="cal-chips">
                    {list.slice(0, 3).map((a) => (
                      <span key={a.id} className={`cal-chip ${a.status}`}>
                        <b>{formatTime(a.appointment_date)}</b>
                        {' '}{a.patient_name || `#${a.id}`}
                      </span>
                    ))}
                    {list.length > 3 && (
                      <span className="cal-more">+{list.length - 3} more</span>
                    )}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {!loading && totalActive === 0 && !loadError && (
        <p className="muted" style={{ marginTop: 4 }}>No active appointments this month.</p>
      )}

      {selectedKey && (
        <div className="modal-backdrop" onClick={() => setSelectedKey(null)}>
          <div
            className="modal glass cal-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Appointments on ${selectedKey}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              <span className="eyebrow">Active calendar</span>
              {new Date(`${selectedKey}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </h2>
            <p className="muted">
              {selectedList.length} active appointment{selectedList.length === 1 ? '' : 's'} — review, approve, reject or cancel.
            </p>
            <div className="cal-details">
              {selectedList.map((a) => (
                <div className="user-row cal-detail-row" key={a.id}>
                  <span className="who">
                    <strong>#{a.id}</strong> {a.patient_name || ''} → {a.doctor_name || ''}
                    <br />
                    {a.clinic_name || ''} · {formatFull(a.appointment_date)} ·{' '}
                    <span className={`cal-status ${a.status}`}>{a.status}</span>
                    {a.reason ? ` · ${a.reason}` : ''}
                  </span>
                  <span className="cal-actions">
                    {a.status === 'pending' && onDecide && (
                      <>
                        <button type="button" className="approve" onClick={() => onDecide(a.id, 'approve')}>
                          Approve
                        </button>
                        <button type="button" className="reject" onClick={() => onDecide(a.id, 'reject')}>
                          Reject
                        </button>
                      </>
                    )}
                    {(a.status === 'pending' || a.status === 'scheduled') && onCancel && (
                      <button type="button" onClick={() => onCancel(a.id)}>
                        Cancel
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <button type="button" className="modal-close" onClick={() => setSelectedKey(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
