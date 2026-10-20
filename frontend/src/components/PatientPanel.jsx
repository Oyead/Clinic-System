import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Notice, useNotice } from './Notice.jsx';
import { PanelTabs, usePersistentTab } from './Tabs.jsx';
import { PatientMiniCalendar } from './PatientMiniCalendar.jsx';
import { SlotPickerCalendar } from './SlotPickerCalendar.jsx';
import { FORM_INPUT, BTN_PRIMARY, BTN_SECONDARY, EYEBROW, SECTION_TITLE } from './ui.js';

const PATIENT_TABS = [
  { id: 'appointments', label: 'My appointments' },
  { id: 'book', label: 'Book appointment' },
];

export function PatientPanel() {
  const { token } = useAuth();
  const [notice, notify, dismissNotice] = useNotice();
  const [tab, setTab] = usePersistentTab('clinic.tab.patient', 'appointments', PATIENT_TABS.map((t) => t.id));
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
      notify('Clinic, doctor, and open slot required.', 'error');
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
    <section className="rounded-[24px] bg-white p-4 shadow-[var(--shadow)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={EYEBROW}>My care</span>
          <h2 className="mt-1.5 font-display text-[1.8rem] font-extrabold leading-tight tracking-[-0.04em] text-[var(--color-ink)]">Dashboard</h2>
        </div>
      </div>
      <Notice notice={notice} onClose={dismissNotice} />
      <div className="mt-5">
        <PanelTabs tabs={PATIENT_TABS} active={tab} onChange={setTab} label="Patient sections" />
      </div>
      {tab === 'appointments' && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className={SECTION_TITLE}>My appointments</h3>
              <p className="mt-1.5 max-w-[62ch] text-[0.88rem] leading-[1.65] text-[var(--color-ink-soft)]">Your appointments at a glance. Only the visible month is loaded - flip months to load more. Tap a dotted day to see that day's visits, or cancel an upcoming one.</p>
            </div>
            <button type="button" className={`${BTN_SECONDARY} px-4 py-2 text-xs`} onClick={() => setRefreshToken((n) => n + 1)}>Refresh month</button>
          </div>
          <div className="mt-4 rounded-[20px] bg-[var(--color-sand)] p-3 sm:p-4">
            <PatientMiniCalendar loadRange={loadRange} reloadKey={`${refreshToken}`} onCancel={cancel} />
          </div>
        </>
      )}

      {tab === 'book' && (
        <>
          <h3 className={`${SECTION_TITLE} mt-6`}>Book appointment</h3>
          <form id="form-book" noValidate onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8rem] font-bold text-[var(--color-ink)]">Clinic</label>
              <select className={FORM_INPUT} value={booking.clinic_id} onChange={(e) => setBooking((b) => ({ ...b, clinic_id: e.target.value, doctor_id: '', slot: null }))}>
                {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8rem] font-bold text-[var(--color-ink)]">Doctor</label>
              <select className={FORM_INPUT} value={booking.doctor_id} onChange={(e) => setBooking((b) => ({ ...b, doctor_id: e.target.value, slot: null }))}>
                {doctorOptions.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.specialization || ''})</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-[0.8rem] font-bold text-[var(--color-ink)]">Open 45-minute slots - pick a dotted day, then a time</label>
              <div className="rounded-[20px] bg-[var(--color-sand)] p-3 sm:p-4">
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
                  <span className="text-[0.78rem] font-medium text-[var(--color-ink-soft)]">Select a clinic and doctor first.</span>
                )}
              </div>
              {booking.slot && (
                <span className="inline-flex w-fit rounded-full bg-[rgba(127,217,168,0.2)] px-3 py-1.5 text-[0.78rem] font-bold text-[#2f7d58]">
                  Picked: {new Date(booking.slot.starts_at).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · 45 min
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-[0.8rem] font-bold text-[var(--color-ink)]">Reason (optional)</label>
              <input className={FORM_INPUT} id="book-reason" type="text" value={booking.reason} onChange={(e) => setBooking((b) => ({ ...b, reason: e.target.value }))} />
            </div>
            <button type="submit" className={`${BTN_PRIMARY} w-fit px-8 py-3 text-sm sm:col-span-2`}>Request appointment</button>
          </form>
        </>
      )}
    </section>
  );
}
