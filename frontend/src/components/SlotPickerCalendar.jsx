import { useEffect, useMemo, useRef, useState } from 'react';
import { api, readError } from '../api/client.js';
import { toDayKey, startOfMonth, monthLabel, buildMonthCells } from './calendarUtils.js';

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

      <div className="mini-cal-grid" role="grid" aria-label={`Open slots for ${monthLabel(cursor)}`}>
        {WEEKDAYS.map((w, i) => (
          <div key={`${w}-${i}`} className="mini-cal-weekday">{w}</div>
        ))}
        {cells.map((cell) => {
          const hasOpen = (byDay.get(cell.key) || []).length > 0;
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
                hasOpen ? 'has-appts' : '',
                cell.key === selectedKey ? 'selected' : '',
              ].join(' ').trim()}
              title={hasOpen ? 'Show open times on this day' : 'No open slots on this day'}
            >
              {cell.date.getDate()}
              {hasOpen && <i className="mini-cal-dot" />}
            </button>
          );
        })}
      </div>

      {!loading && monthSlots.length === 0 && !loadError && (
        <p className="muted">No open slots this month. Try another month or doctor.</p>
      )}

      {selectedKey && (
        <div className="mini-cal-details">
          <strong className="mini-cal-details-title">
            {new Date(`${selectedKey}T12:00:00`).toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
            {' '}· 45 min each
          </strong>
          {selectedList.length === 0
            ? <p className="muted">No open slots on this day.</p>
            : (
              <div className="slot-pick-grid">
                {selectedList.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelect(s)}
                    className={`slot${selectedSlotId === s.id ? ' selected' : ''}`}
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
