import { useMemo, useState } from 'react';
import { toDayKey, startOfMonth, monthLabel, buildMonthCells } from './calendarUtils.js';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function DatePickerCalendar({ value, onChange, minDate }) {
  const [cursor, setCursor] = useState(() => startOfMonth(minDate || new Date()));

  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);

  const minKey = toDayKey(minDate || new Date());
  const todayKey = toDayKey(new Date());

  const go = (delta) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  return (
    <div className="mini-cal-wrap">
      <div className="mini-cal-toolbar">
        <button type="button" className="cal-nav-btn mini" onClick={() => go(-1)} aria-label="Previous month">‹</button>
        <strong className="mini-cal-month">{monthLabel(cursor)}</strong>
        <button type="button" className="cal-nav-btn mini" onClick={() => go(1)} aria-label="Next month">›</button>
      </div>

      <div className="mini-cal-grid" role="grid" aria-label={`Pick a day in ${monthLabel(cursor)}`}>
        {WEEKDAYS.map((w, i) => (
          <div key={`${w}-${i}`} className="mini-cal-weekday">{w}</div>
        ))}
        {cells.map((cell) => {
          const isPast = cell.key < minKey;
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              disabled={isPast}
              onClick={() => onChange(cell.key)}
              className={[
                'mini-cal-day',
                cell.inMonth ? '' : 'out',
                cell.key === todayKey ? 'today' : '',
                isPast ? 'past' : '',
                cell.key === value ? 'selected' : '',
              ].join(' ').trim()}
              title={isPast ? 'Past dates cannot be booked' : 'Pick this day'}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
