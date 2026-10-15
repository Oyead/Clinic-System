import { useCallback, useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Notice, useNotice } from './Notice.jsx';
import { StatusFilter } from './Appointments.jsx';
import { ActiveCalendar } from './ActiveCalendar.jsx';
import { AvailabilityManager } from './AvailabilityManager.jsx';
import { PanelTabs } from './Tabs.jsx';

const STAFF_TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'availability', label: 'Availability' },
  { id: 'clinic', label: 'My clinic' },
];

export function StaffPanel() {
  const { token } = useAuth();
  const [notice, notify] = useNotice();
  const [tab, setTab] = useState('calendar');
  const [status, setStatus] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [options, setOptions] = useState(null);

  const loadRange = useCallback(async ({ from, to }) => {
    const res = await api.appointments(token, status, { from, to });
    if (!res.ok) {
      throw new Error(await readError(res, 'Loading this month failed.'));
    }
    const data = await res.json();
    return data.appointments || [];
  }, [token, status]);

  const decide = async (id, decision) => {
    try {
      const res = await api.decideAppointment(token, id, decision);
      if (res.ok) {
        const data = await res.json();
        notify(data.message || `Appointment ${decision}d.`, 'success');
        setRefreshToken((n) => n + 1);
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
        setRefreshToken((n) => n + 1);
      } else {
        notify(await readError(res, 'Cancellation failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const loadOptions = useCallback(async () => {
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
  }, [token, notify]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  return (
    <section className="card">
      <h2><span className="eyebrow">Care team</span>Dashboard</h2>
      <Notice notice={notice} />
      <PanelTabs tabs={STAFF_TABS} active={tab} onChange={setTab} label="Care team sections" />
      {tab === 'calendar' && (
      <>
      <h3>Active calendar</h3>
      <div className="row">
        <StatusFilter id="staff-status" value={status} onChange={setStatus} />
        <button type="button" style={{ alignSelf: 'flex-end' }} onClick={() => setRefreshToken((n) => n + 1)}>Refresh month</button>
      </div>
      <div><ActiveCalendar loadRange={loadRange} reloadKey={`${status}|${refreshToken}`} onDecide={decide} onCancel={cancel} /></div>
      </>
      )}
      {tab === 'availability' && (
      <>
      <h3>Availability</h3>
      <p>Publish 45-minute slots patients can book. Only the picked day is loaded.</p>
      <div>
        {options === null ? <p className="muted">Loading doctors…</p>
          : <AvailabilityManager token={token} doctors={options.doctors || []} notify={notify} />}
      </div>
      </>
      )}
      {tab === 'clinic' && (
      <>
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
      </>
      )}
    </section>
  );
}
