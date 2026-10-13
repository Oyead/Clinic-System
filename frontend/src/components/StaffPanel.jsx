import { useCallback, useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Notice, useNotice } from './Notice.jsx';
import { AppointmentList, StatusFilter } from './Appointments.jsx';

export function StaffPanel() {
  const { token } = useAuth();
  const [notice, notify] = useNotice();
  const [status, setStatus] = useState('');
  const [queue, setQueue] = useState(null);
  const [options, setOptions] = useState(null);

  const loadQueue = useCallback(async () => {
    try {
      const res = await api.appointments(token, status);
      if (!res.ok) {
        notify(await readError(res, 'Showing queue failed.'), 'error');
        setQueue(null);
        return;
      }
      const data = await res.json();
      setQueue(data.appointments);
    } catch (err) {
      notify(err.message, 'error');
      setQueue(null);
    }
  }, [token, status, notify]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const decide = async (id, decision) => {
    try {
      const res = await api.decideAppointment(token, id, decision);
      if (res.ok) {
        const data = await res.json();
        notify(data.message || `Appointment ${decision}d.`, 'success');
        loadQueue();
      } else {
        notify(await readError(res, `${decision} failed.`), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const cancel = async (id) => {
    try {
      const res = await api.cancelAppointment(token, id);
      if (res.ok) {
        notify('Appointment cancelled.', 'success');
        loadQueue();
      } else {
        notify(await readError(res, 'Cancellation failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const loadOptions = async () => {
    try {
      const res = await api.bookingOptions(token);
      if (!res.ok) {
        notify(await readError(res, 'Showing options failed.'), 'error');
        setOptions(null);
        return;
      }
      const data = await res.json();
      setOptions(data);
    } catch (err) {
      notify(err.message, 'error');
      setOptions(null);
    }
  };

  return (
    <section className="card">
      <h2><span className="eyebrow">Care team</span>Appointment requests</h2>
      <Notice notice={notice} />
      <div className="row">
        <StatusFilter id="staff-status" value={status} onChange={setStatus} />
        <button type="button" style={{ alignSelf: 'flex-end' }} onClick={loadQueue}>Show queue</button>
      </div>
      <p>Review requests assigned to you, then approve, reject or cancel.</p>
      <div>{queue === null ? <p className="muted">Not shown yet.</p> : <AppointmentList appointments={queue} emptyText="No appointments in your scope." onDecide={decide} onCancel={cancel} />}</div>
      <h3>My clinic</h3>
      <div className="row">
        <button type="button" onClick={loadOptions}>Show my clinic &amp; doctors</button>
      </div>
      <div>
        {options === null ? <p className="muted">Not shown yet.</p> : (
          <>
            <div className="audit-row">Clinics: {options.clinics.map((c) => `#${c.id} ${c.name}`).join(', ') || '—'}</div>
            <div className="audit-row">Doctors: {options.doctors.map((d) => `#${d.id} ${d.name} (clinic #${d.clinic_id})`).join(', ') || '—'}</div>
          </>
        )}
      </div>
    </section>
  );
}
