import { useMemo, useState } from 'react';
import { toDayKey, startOfMonth, monthLabel, buildMonthCells } from './calendarUtils.js';
import { BTN_GHOST } from './ui.js';

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        <button type="button" className={`${BTN_GHOST} h-8 w-8 shrink-0 p-0 text-lg leading-none`} onClick={() => go(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong className="min-w-0 flex-1 text-center font-display text-[0.86rem] font-bold tracking-[-0.02em] text-[var(--color-ink)] sm:text-[0.98rem]">{monthLabel(cursor)}</strong>
        <button type="button" className={`${BTN_GHOST} h-8 w-8 shrink-0 p-0 text-lg leading-none`} onClick={() => go(1)} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1" role="grid" aria-label={`Pick a day in ${monthLabel(cursor)}`}>
        {WEEKDAYS.map((w, i) => (
          <div key={`${w}-${i}`} className="py-0.5 text-center font-display text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[var(--color-ink-soft)]">{w}</div>
        ))}
        {cells.map((cell) => {
          const isPast = cell.key < minKey;
          const selected = cell.key === value;
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              disabled={isPast}
              onClick={() => onChange(cell.key)}
              className={[
                'flex h-9 cursor-pointer items-center justify-center rounded-full text-[0.8rem] font-bold text-[var(--color-ink)] transition-colors',
                !cell.inMonth ? 'opacity-30' : '',
                isPast ? 'cursor-default opacity-35' : 'hover:bg-[var(--color-sand)]',
                cell.key === todayKey && !selected ? 'bg-white shadow-[var(--shadow-sm)]' : '',
                selected ? 'bg-[var(--color-ink)] text-white shadow-[var(--shadow-sm)]' : '',
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
