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
    <div className="clockpick">
      <div className="clockpick-top">
        <div className="clockpick-readout" aria-live="polite">
          <button
            type="button"
            onClick={() => setMode('hour')}
            className={`clockpick-segment${mode === 'hour' ? ' active' : ''}`}
            aria-label="Edit hour"
          >
            {hour12 === null ? '--' : pad(hour12)}
          </button>
          <span aria-hidden="true">:</span>
          <button
            type="button"
            onClick={() => setMode('minute')}
            className={`clockpick-segment${mode === 'minute' ? ' active' : ''}`}
            aria-label="Edit minutes"
          >
            {parsed.m === null ? '--' : pad(parsed.m)}
          </button>
          <span className="clockpick-ampm-label">{ampm}</span>
        </div>
        <div className="clockpick-ampm" role="radiogroup" aria-label="AM or PM">
          {['AM', 'PM'].map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={ampm === a}
              onClick={() => pickAmpm(a)}
              className={`clockpick-ampm-btn${ampm === a ? ' selected' : ''}`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="clockpick-face" role="radiogroup" aria-label={mode === 'hour' ? 'Pick an hour' : 'Pick minutes'}>
        {handAngle !== null && (
          <div className="clockpick-hand" style={{ transform: `rotate(${handAngle}deg)` }} aria-hidden="true" />
        )}
        {marks.map((mark, i) => (
          <button
            key={mark}
            type="button"
            role="radio"
            aria-checked={mark === selectedMark}
            aria-label={mode === 'hour' ? `Hour ${mark}` : `${pad(mark)} minutes`}
            onClick={() => (mode === 'hour' ? pickHour(mark) : pickMinute(mark))}
            className={`clockpick-num${mark === selectedMark ? ' selected' : ''}`}
            style={{ transform: `rotate(${i * 30}deg) translateY(-88px) rotate(${-i * 30}deg)` }}
          >
            {mode === 'hour' ? mark : pad(mark)}
          </button>
        ))}
        <div className="clockpick-center" aria-hidden="true" />
      </div>
      <p className="hint">Tap the hour, then the minutes. Tap the time above to adjust.</p>
    </div>
  );
}
