import { useCallback, useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Notice, useNotice } from './Notice.jsx';
import { ActiveCalendar } from './ActiveCalendar.jsx';
import { AvailabilityManager } from './AvailabilityManager.jsx';
import { PanelTabs, usePersistentTab } from './Tabs.jsx';
import { BTN_SECONDARY, EYEBROW, SECTION_TITLE } from './ui.js';

const STAFF_TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'availability', label: 'Availability' },
  { id: 'clinic', label: 'My clinic' },
];

export function StaffPanel() {
  const { token } = useAuth();
  const [notice, notify, dismissNotice] = useNotice();
  const [tab, setTab] = usePersistentTab('clinic.tab.staff', 'calendar', STAFF_TABS.map((t) => t.id));
  const [refreshToken, setRefreshToken] = useState(0);
  const [options, setOptions] = useState(null);

  const loadRange = useCallback(async ({ from, to }) => {
    const res = await api.appointments(token, '', { from, to });
    if (!res.ok) {
      throw new Error(await readError(res, 'Loading this month failed.'));
    }
    const data = await res.json();
    return data.appointments || [];
  }, [token]);

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
    <section className="rounded-[24px] bg-white p-4 shadow-[var(--shadow)] sm:p-7">
      <div>
        <span className={EYEBROW}>Care team</span>
        <h2 className="mt-1.5 font-display text-[1.8rem] font-extrabold leading-tight tracking-[-0.04em] text-[var(--color-ink)]">Dashboard</h2>
      </div>
      <Notice notice={notice} onClose={dismissNotice} />
      <div className="mt-5">
        <PanelTabs tabs={STAFF_TABS} active={tab} onChange={setTab} label="Care team sections" />
      </div>
      {tab === 'calendar' && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <h3 className={SECTION_TITLE}>Active calendar</h3>
            <button type="button" className={`${BTN_SECONDARY} px-4 py-2 text-xs`} onClick={() => setRefreshToken((n) => n + 1)}>Refresh month</button>
          </div>
          <div className="mt-4 rounded-[20px] bg-[var(--color-sand)] p-3 sm:p-4">
            <ActiveCalendar loadRange={loadRange} reloadKey={`${refreshToken}`} onDecide={decide} onCancel={cancel} />
          </div>
        </>
      )}
      {tab === 'availability' && (
        <>
          <h3 className={`${SECTION_TITLE} mt-6`}>Availability</h3>
          <div className="mt-4 rounded-[20px] bg-[var(--color-sand)] p-3 sm:p-4">
            {options === null ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Loading doctors…</p>
              : <AvailabilityManager token={token} doctors={options.doctors || []} notify={notify} />}
          </div>
        </>
      )}
      {tab === 'clinic' && (
        <>
          <h3 className={`${SECTION_TITLE} mt-6`}>My clinic</h3>
          <div className="mt-4 rounded-[20px] bg-[var(--color-sand)] p-4">
            {options === null ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Loading doctors…</p> : (
              <dl className="flex flex-col divide-y divide-[var(--color-line)]">
                <div className="py-3 first:pt-0 last:pb-0">
                  <dt className={EYEBROW}>Clinics</dt>
                  <dd className="mt-1 text-[0.88rem] leading-[1.6] text-[var(--color-ink)]">{options.clinics.map((c) => `#${c.id} ${c.name}`).join(', ') || '-'}</dd>
                </div>
                <div className="py-3 first:pt-0 last:pb-0">
                  <dt className={EYEBROW}>Doctors</dt>
                  <dd className="mt-1 text-[0.88rem] leading-[1.6] text-[var(--color-ink)]">{options.doctors.map((d) => `#${d.id} ${d.name} (clinic #${d.clinic_id})`).join(', ') || '-'}</dd>
                </div>
              </dl>
            )}
          </div>
        </>
      )}
    </section>
  );
}
