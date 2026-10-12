import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export function PatientPanel() {
  const { token, showMessage } = useAuth();
  const [mine, setMine] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [booking, setBooking] = useState({ clinic_id: '', doctor_id: '', date: '', reason: '' });

  const loadMine = useCallback(async () => {
    try {
      const res = await api.myAppointments(token);
      if (!res.ok) {
        showMessage(await readError(res, 'Loading appointments failed.'), 'error');
        setMine(null);
        return;
      }
      const data = await res.json();
      setMine(data.appointments);
    } catch (err) {
      showMessage(err.message, 'error');
      setMine(null);
    }
  }, [token, showMessage]);

  const loadOptions = useCallback(async () => {
    try {
      const res = await api.bookingOptions(token);
      if (!res.ok) return;
      const data = await res.json();
      setClinics(data.clinics ?? []);
      setDoctors(data.doctors ?? []);
      setBooking((b) => ({ ...b, clinic_id: b.clinic_id || String(data.clinics[0]?.id ?? '') }));
      if (!data.clinics.length || !data.doctors.length) {
        showMessage('No clinics or doctors available for booking yet.', 'error');
      }
    } catch (_) {
    }
  }, [token, showMessage]);

  useEffect(() => {
    loadMine();
    loadOptions();
  }, [loadMine, loadOptions]);

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
        showMessage('Appointment cancelled.', 'success');
        loadMine();
      } else {
        showMessage(await readError(res, 'Cancellation failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!booking.clinic_id || !booking.doctor_id || !booking.date) {
      showMessage('Clinic, doctor, and date are required.', 'error');
      return;
    }
    try {
      const res = await api.bookAppointment(token, {
        clinic_id: Number(booking.clinic_id),
        doctor_id: Number(booking.doctor_id),
        appointment_date: new Date(booking.date).toISOString(),
        ...(booking.reason.trim() ? { reason: booking.reason.trim() } : {}),
      });
      if (res.status === 201) {
        showMessage('Appointment requested. It becomes active once the clinic approves it.', 'success');
        setBooking((b) => ({ ...b, date: '', reason: '' }));
        loadMine();
      } else {
        showMessage(await readError(res, 'Booking failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  return (
    <section className="card">
      <h2><span className="eyebrow">My care</span>My appointments</h2>
      <div className="row">
        <button type="button" onClick={loadMine}>Load my appointments</button>
      </div>
      <p>View your appointments or cancel an upcoming one.</p>
      <div>
        {mine === null ? <p className="muted">Not loaded yet.</p>
          : mine.length === 0 ? <p className="muted">No appointments yet. Book one below.</p>
          : mine.map((a) => (
            <div className="user-row" key={a.id}>
              <span className="who">{a.doctor_name || ''} @ {a.clinic_name || ''}<br />{new Date(a.appointment_date).toLocaleString()} · {a.status}</span>
              <button type="button" disabled={a.status === 'cancelled'} onClick={() => cancel(a.id)}>Cancel</button>
            </div>
          ))}
      </div>

      <h2>Book appointment</h2>
      <form id="form-book" noValidate onSubmit={submit}>
        <label>
          Clinic
          <select value={booking.clinic_id} onChange={(e) => setBooking((b) => ({ ...b, clinic_id: e.target.value, doctor_id: '' }))}>
            {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          Doctor
          <select value={booking.doctor_id} onChange={(e) => setBooking((b) => ({ ...b, doctor_id: e.target.value }))}>
            {doctorOptions.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.specialization || ''})</option>)}
          </select>
        </label>
        <label>
          Date &amp; time (must be in the future)
          <input id="book-date" type="datetime-local" required value={booking.date} onChange={(e) => setBooking((b) => ({ ...b, date: e.target.value }))} />
        </label>
        <label>
          Reason (optional)
          <input id="book-reason" type="text" value={booking.reason} onChange={(e) => setBooking((b) => ({ ...b, reason: e.target.value }))} />
        </label>
        <button type="submit">Request appointment</button>
      </form>
    </section>
  );
}
