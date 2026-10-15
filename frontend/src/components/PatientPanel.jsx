import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Notice, useNotice } from './Notice.jsx';
import { PanelTabs } from './Tabs.jsx';
import { PatientMiniCalendar } from './PatientMiniCalendar.jsx';
import { SlotPickerCalendar } from './SlotPickerCalendar.jsx';

const PATIENT_TABS = [
  { id: 'appointments', label: 'My appointments' },
  { id: 'book', label: 'Book appointment' },
];

export function PatientPanel() {
  const { token } = useAuth();
  const [notice, notify] = useNotice();
  const [tab, setTab] = useState('appointments');
  const [refreshToken, setRefreshToken] = useState(0);
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [booking, setBooking] = useState({ clinic_id: '', doctor_id: '', slot: null, reason: '' });

  const loadRange = useCallback(async ({ from, to }) => {
    const res = await api.myAppointments(token, { from, to });
    if (!res.ok) {
      throw new Error(await readError(res, 'Loading this month failed.'));
    }
    const data = await res.json();
    return data.appointments || [];
  }, [token]);

  const loadOptions = useCallback(async () => {
    try {
      const res = await api.bookingOptions(token);
      if (!res.ok) return;
      const data = await res.json();
      setClinics(data.clinics ?? []);
      setDoctors(data.doctors ?? []);
      setBooking((b) => ({ ...b, clinic_id: b.clinic_id || String(data.clinics[0]?.id ?? '') }));
      if (!data.clinics.length || !data.doctors.length) {
        notify('No clinics or doctors available for booking yet.', 'error');
      }
    } catch (_) {
    }
  }, [token, notify]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const doctorOptions = useMemo(
    () => doctors.filter((d) => String(d.clinic_id) === String(booking.clinic_id)),
    [doctors, booking.clinic_id],
  );

  useEffect(() => {
    if (doctorOptions.length && !doctorOptions.some((d) => String(d.id) === String(booking.doctor_id))) {
      setBooking((b) => ({ ...b, doctor_id: String(doctorOptions[0].id) }));
    }
  }, [doctorOptions, booking.doctor_id]);

  const cancel = async (id) => {
    try {
      const res = await api.cancelAppointment(token, id);
      if (res.ok) {
        notify('Appointment cancelled.', 'success');
        setRefreshToken((n) => n + 1);
      } else {
        notify(await readError(res, 'Cancellation failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!booking.clinic_id || !booking.doctor_id || !booking.slot) {
      notify('Clinic, doctor, and an open time slot are required. Pick a dotted day, then a time.', 'error');
      return;
    }
    try {
      const res = await api.bookAppointment(token, {
        slot_id: booking.slot.id,
        ...(booking.reason.trim() ? { reason: booking.reason.trim() } : {}),
      });
      if (res.status === 201) {
        notify('Appointment requested. It becomes active once the clinic approves it.', 'success');
        setBooking((b) => ({ ...b, slot: null, reason: '' }));
        setRefreshToken((n) => n + 1);
        setTab('appointments');
      } else {
        notify(await readError(res, 'Booking failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <section className="card">
      <h2><span className="eyebrow">My care</span>Dashboard</h2>
      <Notice notice={notice} />
      <PanelTabs tabs={PATIENT_TABS} active={tab} onChange={setTab} label="Patient sections" />
      {tab === 'appointments' && (
      <>
      <h3>My appointments</h3>
      <div className="row">
        <button type="button" onClick={() => setRefreshToken((n) => n + 1)}>Refresh month</button>
      </div>
      <p>Your appointments at a glance. Only the visible month is loaded — flip months to load more. Tap a dotted day to see that day's visits, or cancel an upcoming one.</p>
      <div><PatientMiniCalendar loadRange={loadRange} reloadKey={`${refreshToken}`} onCancel={cancel} /></div>
      </>
      )}

      {tab === 'book' && (
      <>
      <h3>Book appointment</h3>
      <form id="form-book" noValidate onSubmit={submit}>
        <label>
          Clinic
          <select value={booking.clinic_id} onChange={(e) => setBooking((b) => ({ ...b, clinic_id: e.target.value, doctor_id: '', slot: null }))}>
            {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          Doctor
          <select value={booking.doctor_id} onChange={(e) => setBooking((b) => ({ ...b, doctor_id: e.target.value, slot: null }))}>
            {doctorOptions.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.specialization || ''})</option>)}
          </select>
        </label>
        <label>
          Open 45-minute slots — pick a dotted day, then a time
          {booking.clinic_id && booking.doctor_id ? (
            <SlotPickerCalendar
              key={`${booking.clinic_id}|${booking.doctor_id}`}
              token={token}
              clinicId={booking.clinic_id}
              doctorId={booking.doctor_id}
              selectedSlotId={booking.slot ? booking.slot.id : null}
              onSelect={(slot) => setBooking((b) => ({ ...b, slot }))}
            />
          ) : (
            <span className="hint">Select a clinic and doctor first.</span>
          )}
          {booking.slot && (
            <span className="slot-picked">
              Picked: {new Date(booking.slot.starts_at).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · 45 min
            </span>
          )}
        </label>
        <label>
          Reason (optional)
          <input id="book-reason" type="text" value={booking.reason} onChange={(e) => setBooking((b) => ({ ...b, reason: e.target.value }))} />
        </label>
        <button type="submit">Request appointment</button>
      </form>
      </>
      )}
    </section>
  );
}
