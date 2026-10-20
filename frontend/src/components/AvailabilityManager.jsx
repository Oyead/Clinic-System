import { useCallback, useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { DatePickerCalendar } from './DatePickerCalendar.jsx';
import { TimeSlotPicker } from './TimeSlotPicker.jsx';
import { formatTime } from './calendarUtils.js';
import { FORM_INPUT, BTN_PRIMARY, BTN_GHOST, EYEBROW, statusPill } from './ui.js';

const SLOT_MINUTES = 45;

export function AvailabilityManager({ token, doctors, notify }) {
  const [doctorId, setDoctorId] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (doctors.length && !doctors.some((d) => String(d.id) === String(doctorId))) {
      setDoctorId(String(doctors[0].id));
    }
  }, [doctors, doctorId]);

  const loadDay = useCallback(async () => {
    if (!doctorId || !day) {
      setSlots(null);
      return;
    }
    setDayLoading(true);
    try {
      const from = new Date(`${day}T00:00:00`).toISOString();
      const d = new Date(`${day}T12:00:00`);
      const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
      const res = await api.availability(token, { doctor_id: doctorId, from, to });
      if (!res.ok) {
        notify(await readError(res, 'Loading slots failed.'), 'error');
        setSlots(null);
        return;
      }
      const data = await res.json();
      setSlots(data.slots || []);
    } catch (err) {
      notify(err.message, 'error');
      setSlots(null);
    } finally {
      setDayLoading(false);
    }
  }, [token, doctorId, day, notify]);

  useEffect(() => {
    loadDay();
  }, [loadDay, refreshToken]);

  const addSlot = async () => {
    if (!doctorId || !day || !time) {
      notify('Doctor, day, and start time are required.', 'error');
      return;
    }
    const startsAt = new Date(`${day}T${time}:00`);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      notify('The slot must start in the future.', 'error');
      return;
    }
    const newEnd = new Date(startsAt.getTime() + SLOT_MINUTES * 60000);
    const overlap = (slots || []).find((s) => {
      const existingStart = new Date(s.starts_at);
      const existingEnd = new Date(existingStart.getTime() + SLOT_MINUTES * 60000);
      return startsAt < existingEnd && existingStart < newEnd;
    });
    if (overlap) {
      notify(`This slot overlaps an existing ${formatTime(overlap.starts_at)} slot.`, 'error');
      return;
    }
    try {
      const res = await api.createAvailability(token, {
        doctor_id: Number(doctorId),
        starts_at: [startsAt.toISOString()],
      });
      const payload = await res.json().catch(() => ({}));
      if (res.status === 201) {
        notify(payload.message || 'Availability slot published (45 minutes).', 'success');
        if (payload.conflicts && payload.conflicts.length) {
          notify(`Skipped: ${payload.conflicts.map((c) => c.reason).join('; ')}`, 'error');
        }
        setRefreshToken((n) => n + 1);
      } else {
        const detail = payload.conflicts && payload.conflicts.length
          ? ` ${payload.conflicts.map((c) => `${c.starts_at}: ${c.reason}`).join('; ')}`
          : '';
        notify((payload.error || 'Publishing slot failed.') + detail, 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const removeSlot = async (id) => {
    try {
      const res = await api.deleteAvailability(token, id);
      if (res.ok) {
        notify('Availability slot withdrawn.', 'success');
        setRefreshToken((n) => n + 1);
      } else {
        notify(await readError(res, 'Withdrawing slot failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start gap-2.5">
        <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-[0.8rem] font-bold text-[var(--color-ink)]">
          Doctor
          <select className={FORM_INPUT} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.specialization || ''})</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-col items-stretch gap-4 lg:flex-row lg:gap-4">
        <div className="flex-1 rounded-[20px] bg-white p-4 shadow-[var(--shadow-sm)]">
          <DatePickerCalendar value={day} onChange={setDay} />
        </div>
        <div className="flex-1 rounded-[20px] bg-white p-4 shadow-[var(--shadow-sm)]">
          <TimeSlotPicker value={time} onChange={setTime} />
        </div>
      </div>
      <div className="mt-4 flex gap-2.5">
        <button type="button" className={`${BTN_PRIMARY} px-6 py-2.5 text-sm`} onClick={addSlot}>Publish 45-min slot</button>
      </div>
      <h4 className="mt-6 font-display text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--color-ink)]">
        {day
          ? `Slots on ${new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`
          : 'Slots'}
      </h4>
      <div className="mt-2">
        {dayLoading ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Loading…</p>
          : slots === null ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Pick a doctor and a day to see slots.</p>
          : slots.length === 0 ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">No slots published for this day yet.</p>
          : (
            <div className="flex flex-col divide-y divide-[var(--color-line)]">
              {slots.map((s) => (
                <div className="flex flex-wrap items-center gap-2.5 py-3 text-sm" key={s.id}>
                  <span className="min-w-0 flex-1 leading-[1.6] text-[var(--color-ink)]">
                    {formatTime(s.starts_at)} · 45 min · {s.doctor_name || ''} @ {s.clinic_name || ''}
                    <br />
                    <span className={statusPill(s.status)}>{s.status}</span>
                  </span>
                  {s.status === 'open' && (
                    <button type="button" className={`${BTN_GHOST} px-3.5 py-1.5 text-xs`} onClick={() => removeSlot(s.id)}>Withdraw</button>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
      <p className={`${EYEBROW} mt-4`}>Booked slots free up on cancel/reject.</p>
    </div>
  );
}
