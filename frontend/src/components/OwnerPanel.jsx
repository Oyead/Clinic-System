import { useCallback, useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Notice, useNotice } from './Notice.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { TokenReveal } from './SecretField.jsx';
import { StatusFilter } from './Appointments.jsx';
import { ActiveCalendar } from './ActiveCalendar.jsx';
import { AvailabilityManager } from './AvailabilityManager.jsx';
import { PanelTabs, usePersistentTab } from './Tabs.jsx';
import { FORM_INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, EYEBROW, SECTION_TITLE, statusPill } from './ui.js';

const OWNER_TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'availability', label: 'Availability' },
  { id: 'staff', label: 'Staff' },
  { id: 'reports', label: 'Reports' },
];

export function OwnerPanel() {
  const { token } = useAuth();
  const [notice, notify, dismissNotice] = useNotice();
  const [clinics, setClinics] = useState([]);
  const [clinicId, setClinicId] = useState('');
  const [staff, setStaff] = useState(null);
  const [invites, setInvites] = useState(null);
  const [status, setStatus] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'doctor', name: '', specialization: '' });
  const [lastToken, setLastToken] = useState('');
  const [reportRange, setReportRange] = useState({ from: '', to: '' });
  const [report, setReport] = useState(null);
  const [tab, setTab] = usePersistentTab('clinic.tab.owner', 'calendar', OWNER_TABS.map((t) => t.id));
  const [allDoctors, setAllDoctors] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const ownerApi = useCallback(
    (path, options) => api.owner(token, path, options),
    [token],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.bookingOptions(token);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setAllDoctors(data.doctors ?? []);
      } catch (_) {
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const clinicDoctors = allDoctors.filter((d) => String(d.clinic_id) === String(clinicId));

  const activeClinic = clinics.find((c) => String(c.id) === String(clinicId));
  const clinicLocked = !activeClinic || activeClinic.status !== 'active';

  const loadStaff = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await ownerApi(`/clinics/${id}/staff`);
      if (!res.ok) {
        notify(await readError(res, 'Showing staff failed.'), 'error');
        return;
      }
      const data = await res.json();
      setStaff(data.staff);
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [ownerApi, notify]);

  const loadInvites = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await ownerApi(`/clinics/${id}/invites`);
      if (!res.ok) {
        if (res.status !== 403) notify(await readError(res, 'Showing invites failed.'), 'error');
        setInvites(null);
        return;
      }
      const data = await res.json();
      setInvites(data.invites);
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [ownerApi, notify]);

  const loadRange = useCallback(async ({ from, to }) => {
    if (!clinicId) return [];
    const res = await api.ownerAppointments(token, clinicId, status, { from, to });
    if (!res.ok) {
      throw new Error(await readError(res, 'Loading this month failed.'));
    }
    const data = await res.json();
    return data.appointments || [];
  }, [token, clinicId, status]);

  const loadClinics = useCallback(async () => {
    try {
      const res = await ownerApi('/clinics');
      if (!res.ok) {
        notify(await readError(res, 'Showing clinics failed.'), 'error');
        return;
      }
      const data = await res.json();
      setClinics(data.clinics);
      if (!data.clinics.length) {
        notify('No clinics assigned to your account yet.', 'error');
        return;
      }
      setClinicId((prev) => prev || String(data.clinics[0].id));
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [ownerApi, notify]);

  useEffect(() => {
    loadClinics();
  }, [loadClinics]);

  useEffect(() => {
    if (!clinicId) return;
    loadStaff(clinicId);
    loadInvites(clinicId);
  }, [clinicId, loadStaff, loadInvites]);

  const reloadAll = () => {
    if (!clinicId) return;
    loadStaff(clinicId);
    loadInvites(clinicId);
    setRefreshToken((n) => n + 1);
  };

  const submitInvite = async (e) => {
    e.preventDefault();
    const { email, role, name, specialization } = inviteForm;
    if (!email.trim() || !name.trim()) {
      notify('Email and name are required.', 'error');
      return;
    }
    try {
      const res = await ownerApi(`/clinics/${clinicId}/staff/invite`, {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          role,
          name: name.trim(),
          ...(specialization.trim() ? { specialization: specialization.trim() } : {}),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.status === 201) {
        notify(payload.message || 'Invite created.', 'success');
        setLastToken(payload.inviteToken || '');
        setInviteForm({ email: '', role: 'doctor', name: '', specialization: '' });
        loadStaff(clinicId);
        loadInvites(clinicId);
      } else {
        notify(payload.error || 'Creating invite failed.', 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const resendInvite = async (inviteId) => {
    try {
      const res = await ownerApi(`/clinics/${clinicId}/invites/${inviteId}/resend`, { method: 'POST' });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        notify('Invite resent.', 'success');
        setLastToken(payload.inviteToken || '');
        loadInvites(clinicId);
      } else {
        notify(payload.error || 'Resending invite failed.', 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const revokeInvite = async (inviteId) => {
    setConfirm({ action: 'revoke', id: inviteId });
  };

  const suspendStaff = async (userId) => {
    setConfirm({ action: 'suspend', id: userId });
  };

  const offboardStaff = async (userId) => {
    setConfirm({ action: 'offboard', id: userId });
  };

  const CONFIRM_COPY = {
    revoke: {
      title: 'Revoke this invite?',
      message: 'The never-activated account is offboarded and the email freed.',
      confirmLabel: 'Revoke invite',
    },
    suspend: (id) => ({
      title: `Suspend staff #${id}?`,
      message: 'They lose access until reinstated or offboarded.',
      confirmLabel: 'Suspend staff',
    }),
    offboard: (id) => ({
      title: `Offboard staff #${id}?`,
      message: 'Clean departure: access removed, email anonymized and freed.',
      confirmLabel: 'Offboard staff',
    }),
  };

  const describeConfirm = () => {
    if (!confirm) return { title: '', message: '', confirmLabel: 'Confirm' };
    if (confirm.action === 'revoke') return CONFIRM_COPY.revoke;
    if (confirm.action === 'suspend') return CONFIRM_COPY.suspend(confirm.id);
    return CONFIRM_COPY.offboard(confirm.id);
  };

  const handleConfirmAction = async () => {
    if (!confirm) return;
    const { action, id } = confirm;
    setBusy(true);
    try {
      const res = action === 'revoke'
        ? await ownerApi(`/clinics/${clinicId}/invites/${id}`, { method: 'DELETE' })
        : action === 'suspend'
          ? await ownerApi(`/clinics/${clinicId}/staff/${id}/suspend`, { method: 'POST' })
          : await ownerApi(`/clinics/${clinicId}/staff/${id}/offboard`, { method: 'POST' });
      if (res.ok) {
        notify(
          action === 'revoke' ? 'Invite revoked.'
            : action === 'suspend' ? 'Staff suspended.'
              : 'Staff offboarded.',
          'success',
        );
        loadStaff(clinicId);
        if (action === 'revoke') loadInvites(clinicId);
      } else {
        notify(
          await readError(
            res,
            action === 'revoke' ? 'Revoking invite failed.'
              : action === 'suspend' ? 'Suspending staff failed.'
                : 'Offboarding staff failed.',
          ),
          'error',
        );
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const decide = async (id, decision) => {
    try {
      const res = await ownerApi(`/appointments/${id}/${decision}`, { method: 'PATCH' });
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

  const reportQuery = () => {
    const params = new URLSearchParams();
    if (reportRange.from) params.set('from', reportRange.from);
    if (reportRange.to) params.set('to', reportRange.to);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const loadApptReport = async () => {
    try {
      const res = await ownerApi(`/clinics/${clinicId}/reports/appointments${reportQuery()}`);
      if (!res.ok) {
        notify(await readError(res, 'Showing report failed.'), 'error');
        return;
      }
      const data = await res.json();
      setReport({ type: 'appointments', data });
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const loadBillingReport = async () => {
    try {
      const res = await ownerApi(`/clinics/${clinicId}/reports/billing${reportQuery()}`);
      if (!res.ok) {
        notify(await readError(res, 'Showing report failed.'), 'error');
        return;
      }
      const data = await res.json();
      setReport({ type: 'billing', data });
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <section className="rounded-[24px] bg-white p-4 shadow-[var(--shadow)] sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className={EYEBROW}>Clinic owner</span>
          <h2 className="mt-1.5 font-display text-[1.8rem] font-extrabold leading-tight tracking-[-0.04em] text-[var(--color-ink)]">My clinics</h2>
        </div>
        <label className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[220px] text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[var(--color-ink-soft)]">
          Active clinic
          <select className={`${FORM_INPUT} bg-[var(--color-sand)] normal-case tracking-normal`} value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
            {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status && c.status !== 'active' ? ` (${c.status})` : ''}</option>)}
          </select>
        </label>
      </div>
      <Notice notice={notice} onClose={dismissNotice} />
      {clinicLocked && (
        <p className="mt-3 rounded-[16px] bg-[rgba(245,196,77,0.28)] px-4 py-3 text-[0.82rem] font-medium text-[#6b5109]" role="status">
          This clinic is pending platform verification. Staff invites unlock after an admin approves it.
        </p>
      )}
      <div className="mt-5">
        <PanelTabs tabs={OWNER_TABS} active={tab} onChange={setTab} label="Clinic owner sections" />
      </div>

      {tab === 'availability' && (
        <>
          <h3 className={`${SECTION_TITLE} mt-6`}>Availability</h3>
          <div className="mt-4 rounded-[20px] bg-[var(--color-sand)] p-3 sm:p-4">
            {!clinicId ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Select a clinic above first.</p>
              : <AvailabilityManager token={token} doctors={clinicDoctors} notify={notify} />}
          </div>
        </>
      )}

      {tab === 'staff' && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h3 className={SECTION_TITLE}>Staff</h3>
            {staff && staff.length > 0 && (
              <div className="flex items-center" aria-label={`${staff.length} staff members`}>
                {staff.slice(0, 3).map((s, i) => (
                  <span
                    key={s.user_id}
                    title={s.email}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[var(--color-sand)] font-display text-[0.72rem] font-bold text-[var(--color-ink)] shadow-[var(--shadow-sm)] ${i > 0 ? '-ml-2.5' : ''}`}
                  >
                    {(s.email || '?').slice(0, 1).toUpperCase()}
                  </span>
                ))}
                {staff.length > 3 && (
                  <span className="-ml-2.5 flex h-9 min-w-9 items-center justify-center rounded-full border-2 border-white bg-[var(--color-ink)] px-1.5 text-[0.66rem] font-bold text-white">+{staff.length - 3}</span>
                )}
              </div>
            )}
          </div>
          <div className="mt-3">
            {staff === null ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Not shown yet.</p>
              : staff.length === 0 ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">No staff yet. Send the first invite below.</p>
              : (
                <div className="flex flex-col divide-y divide-[var(--color-line)]">
                  {staff.map((s) => (
                    <div className="flex flex-wrap items-center gap-3 py-3.5 text-sm" key={s.user_id}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[var(--color-sand)] font-display text-[0.8rem] font-bold text-[var(--color-ink)] shadow-[var(--shadow-sm)]">
                        {(s.email || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 leading-[1.6] text-[var(--color-ink)] [overflow-wrap:anywhere]">
                        {s.email}<br />
                        <span className="text-[0.8rem] text-[var(--color-ink-soft)]">
                          {s.role}{s.role === 'doctor' ? ` (${s.specialization || ''})` : ''}
                        </span>
                        {' '}
                        <span className={statusPill(s.status || (s.is_active ? 'active' : 'inactive'))}>{s.status || (s.is_active ? 'active' : 'inactive')}</span>
                      </span>
                      <span className="flex w-full flex-wrap gap-2 sm:w-auto">
                        {s.status === 'active' && (
                          <button type="button" className={`${BTN_DANGER} px-3.5 py-1.5 text-xs`} onClick={() => suspendStaff(s.user_id)}>Suspend</button>
                        )}
                        {(s.status === 'active' || s.status === 'suspended') && (
                          <button type="button" className={`${BTN_DANGER} px-3.5 py-1.5 text-xs`} onClick={() => offboardStaff(s.user_id)}>Offboard</button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </div>

          <h3 className={`${SECTION_TITLE} mt-7`}>Invite staff</h3>
          <form noValidate onSubmit={submitInvite} id="form-owner-staff" className="mt-3 grid gap-3 rounded-[20px] bg-[var(--color-sand)] p-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Email<input type="email" required className={`${FORM_INPUT} bg-white`} value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Role
              <select value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))} className={`${FORM_INPUT} bg-white`}>
                <option value="doctor">doctor</option>
                <option value="receptionist">receptionist</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Name<input type="text" required className={`${FORM_INPUT} bg-white`} value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Specialization <span className="font-medium text-[var(--color-ink-soft)]">doctors only</span>
              <input type="text" className={`${FORM_INPUT} bg-white`} value={inviteForm.specialization} onChange={(e) => setInviteForm((f) => ({ ...f, specialization: e.target.value }))} />
            </label>
            <button type="submit" className={`${BTN_PRIMARY} w-fit px-6 py-2.5 text-sm sm:col-span-2`} disabled={clinicLocked}>Send invite</button>
          </form>
          {lastToken && (
            <TokenReveal token={lastToken} title="Latest invite token - share it with the invitee" />
          )}

          <h3 className={`${SECTION_TITLE} mt-7`}>Pending invites</h3>
          <div className="mt-2">
            {invites === null ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Not shown yet.</p>
              : invites.filter((i) => !i.accepted_at && !i.revoked_at).length === 0
                ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">No pending invites.</p>
                : (
                  <div className="flex flex-col divide-y divide-[var(--color-line)]">
                    {invites.filter((i) => !i.accepted_at && !i.revoked_at).map((i) => (
                      <div className="flex flex-wrap items-center gap-3 py-3.5 text-sm" key={i.id}>
                        <span className="min-w-0 flex-1 leading-[1.6] text-[var(--color-ink)] [overflow-wrap:anywhere]">
                          {i.user_email}<br />
                          <span className="text-[0.8rem] text-[var(--color-ink-soft)]">{i.role} · expires {new Date(i.expires_at).toLocaleString()}</span>
                        </span>
                        <span className={statusPill('invited')}>invited</span>
                        <span className="flex w-full flex-wrap gap-2 sm:w-auto">
                          <button type="button" className={`${BTN_GHOST} px-3.5 py-1.5 text-xs`} onClick={() => resendInvite(i.id)}>Resend</button>
                          <button type="button" className={`${BTN_DANGER} px-3.5 py-1.5 text-xs`} onClick={() => revokeInvite(i.id)}>Revoke</button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
          </div>
        </>
      )}

      {tab === 'calendar' && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <h3 className={SECTION_TITLE}>Active calendar</h3>
            <StatusFilter id="owner-status" value={status} onChange={setStatus} />
          </div>
          <div className="mt-4 rounded-[20px] bg-[var(--color-sand)] p-3 sm:p-4">
            {!clinicId ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Not shown yet.</p>
              : <ActiveCalendar loadRange={loadRange} reloadKey={`${clinicId}|${status}|${refreshToken}`} onDecide={decide} onCancel={cancel} />}
          </div>
        </>
      )}

      {tab === 'reports' && (
        <>
          <h3 className={`${SECTION_TITLE} mt-6`}>Reports</h3>
          <div className="mt-3 grid gap-3 rounded-[20px] bg-[var(--color-sand)] p-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[0.78rem] font-bold text-[var(--color-ink)]">
              From <input type="date" value={reportRange.from} onChange={(e) => setReportRange((r) => ({ ...r, from: e.target.value }))} className={`${FORM_INPUT} bg-white`} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.78rem] font-bold text-[var(--color-ink)]">
              To <input type="date" value={reportRange.to} onChange={(e) => setReportRange((r) => ({ ...r, to: e.target.value }))} className={`${FORM_INPUT} bg-white`} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={`${BTN_SECONDARY} px-4 py-2 text-xs`} onClick={loadApptReport}>Appointments report</button>
            <button type="button" className={`${BTN_SECONDARY} px-4 py-2 text-xs`} onClick={loadBillingReport}>Billing report</button>
          </div>
          <div className="mt-4">
            {report === null ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Not shown yet.</p>
              : report.type === 'appointments' ? (
                <>
                  <h4 className="mt-2 font-display text-[1rem] font-bold text-[var(--color-ink)]">By status</h4>
                  <ReportTable headers={['Status', 'Count']} rows={report.data.by_status.map((r) => [r.status, r.count])} />
                  <h4 className="mt-5 font-display text-[1rem] font-bold text-[var(--color-ink)]">Per doctor</h4>
                  <ReportTable headers={['Doctor', 'Status', 'Count']} rows={report.data.per_doctor.map((r) => [r.doctor_name, r.status, r.count])} />
                </>
              ) : (
                <>
                  <h4 className="mt-2 font-display text-[1rem] font-bold text-[var(--color-ink)]">Overall: {report.data.overall.bills} bills, total {report.data.overall.total}</h4>
                  <ReportTable headers={['Payment status', 'Bills', 'Total']} rows={report.data.by_payment_status.map((r) => [r.payment_status || '-', r.bills, r.total])} />
                </>
              )}
          </div>
        </>
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={describeConfirm().title}
        message={describeConfirm().message}
        confirmLabel={describeConfirm().confirmLabel}
        danger
        busy={busy}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
}

function ReportTable({ headers, rows }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-[18px] bg-[var(--color-sand)] p-2">
      <table className="w-full border-collapse text-[0.85rem]">
        <thead>
          <tr>
            {headers.map((h) => <th key={h} className="px-3 py-2 text-left font-display text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--color-ink-soft)]">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[var(--color-line)]">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 text-left text-[var(--color-ink)]">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
