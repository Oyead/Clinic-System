import { useMemo, useState } from 'react';

const HOUR_MARKS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_MARKS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const pad = (n) => String(n).padStart(2, '0');

export function TimeSlotPicker({ value, onChange }) {
  const [mode, setMode] = useState('hour');

  const parsed = useMemo(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':').map(Number);
      if (Number.isInteger(h) && Number.isInteger(m)) return { h, m };
    }
    return { h: null, m: null };
  }, [value]);

  const ampm = parsed.h === null ? 'AM' : parsed.h < 12 ? 'AM' : 'PM';
  const hour12 = parsed.h === null ? null : parsed.h % 12 === 0 ? 12 : parsed.h % 12;

  const pickAmpm = (next) => {
    if (parsed.h === null) {
      onChange(`${next === 'AM' ? '09' : '13'}:${pad(parsed.m ?? 0)}`);
    } else {
      const h12 = parsed.h % 12;
      onChange(`${pad(next === 'AM' ? h12 : h12 + 12)}:${pad(parsed.m)}`);
    }
  };

  const pickHour = (h12) => {
    const h24 = ampm === 'AM' ? h12 % 12 : (h12 % 12) + 12;
    onChange(`${pad(h24)}:${pad(parsed.m ?? 0)}`);
    setMode('minute');
  };

  const pickMinute = (m) => {
    onChange(`${pad(parsed.h ?? 9)}:${pad(m)}`);
  };

  const marks = mode === 'hour' ? HOUR_MARKS : MINUTE_MARKS;
  const selectedMark = mode === 'hour' ? hour12 : parsed.m;
  const selectedIndex = marks.findIndex((v) => v === selectedMark);
  const handAngle = selectedIndex === -1 ? null : selectedIndex * 30;

  return (
    <div className="flex max-w-[320px] flex-col gap-3 rounded-[20px] bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <button
            type="button"
            onClick={() => setMode('hour')}
            className={`cursor-pointer rounded-full px-2 py-1 font-display text-[1.05rem] font-bold transition-colors ${mode === 'hour' ? 'bg-[var(--color-sand)] text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'}`}
            aria-label="Edit hour"
          >
            {hour12 === null ? '--' : pad(hour12)}
          </button>
          <span aria-hidden="true" className="text-[var(--color-ink-soft)]">:</span>
          <button
            type="button"
            onClick={() => setMode('minute')}
            className={`cursor-pointer rounded-full px-2 py-1 font-display text-[1.05rem] font-bold transition-colors ${mode === 'minute' ? 'bg-[var(--color-sand)] text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'}`}
            aria-label="Edit minutes"
          >
            {parsed.m === null ? '--' : pad(parsed.m)}
          </button>
          <span className="text-[0.8rem] font-bold text-[var(--color-ink-soft)]">{ampm}</span>
        </div>
        <div className="flex gap-0.5 rounded-full bg-[var(--color-sand)] p-0.5" role="radiogroup" aria-label="AM or PM">
          {['AM', 'PM'].map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={ampm === a}
              onClick={() => pickAmpm(a)}
              className={`cursor-pointer rounded-full px-3 py-1 text-[0.72rem] font-display font-bold transition-colors ${ampm === a ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'}`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex h-58 w-58 items-center justify-center rounded-full bg-[var(--color-sand)]" role="radiogroup" aria-label={mode === 'hour' ? 'Pick an hour' : 'Pick minutes'}>
        {handAngle !== null && (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[88px] w-px origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-[var(--color-ink)] opacity-30 transition-transform"
            style={{ transform: `rotate(${handAngle}deg)` }}
            aria-hidden="true"
          />
        )}
        {marks.map((mark, i) => (
          <button
            key={mark}
            type="button"
            role="radio"
            aria-checked={mark === selectedMark}
            aria-label={mode === 'hour' ? `Hour ${mark}` : `${pad(mark)} minutes`}
            onClick={() => (mode === 'hour' ? pickHour(mark) : pickMinute(mark))}
            className={`absolute left-1/2 top-1/2 flex h-8 w-8 cursor-pointer -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[0.9rem] font-bold transition-colors ${mark === selectedMark ? 'bg-[var(--color-ink)] text-white shadow-[var(--shadow-sm)]' : 'text-[var(--color-ink)] hover:bg-white'}`}
            style={{
              transform: `rotate(${i * 30}deg) translateY(-88px) rotate(${-i * 30}deg)`,
            }}
          >
            {mode === 'hour' ? mark : pad(mark)}
          </button>
        ))}
        <div className="pointer-events-none h-2.5 w-2.5 rounded-full bg-[var(--color-mustard)]" aria-hidden="true" />
      </div>
    </div>
  );
}
