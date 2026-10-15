import { useCallback, useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { DatePickerCalendar } from './DatePickerCalendar.jsx';
import { TimeSlotPicker } from './TimeSlotPicker.jsx';
import { formatTime } from './calendarUtils.js';

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
      <div className="row">
        <label style={{ flex: 1 }}>
          Doctor
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.specialization || ''})</option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint">Pick a day, then a start time. Each slot lasts 45 minutes. Overlapping or after-hours starts are rejected.</p>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <DatePickerCalendar value={day} onChange={setDay} />
        </div>
        <div style={{ flex: 1 }}>
          <TimeSlotPicker value={time} onChange={setTime} />
        </div>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" onClick={addSlot}>Publish 45-min slot</button>
      </div>
      <h4>
        {day
          ? `Slots on ${new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`
          : 'Slots'}
      </h4>
      <div>
        {dayLoading ? <p className="muted">Loading…</p>
          : slots === null ? <p className="muted">Pick a doctor and a day to see slots.</p>
          : slots.length === 0 ? <p className="muted">No slots published for this day yet.</p>
          : slots.map((s) => (
            <div className="user-row" key={s.id}>
              <span className="who">
                {formatTime(s.starts_at)} · 45 min · {s.doctor_name || ''} @ {s.clinic_name || ''}
                <br />
                <span className={`cal-status ${s.status}`}>{s.status}</span>
              </span>
              {s.status === 'open' && (
                <button type="button" className="remove" onClick={() => removeSlot(s.id)}>Withdraw</button>
              )}
            </div>
          ))}
      </div>
      <p className="hint">Booked slots stay visible until the appointment is cancelled or rejected, which frees them again. Withdrawn slots disappear for patients.</p>
    </div>
  );
}
