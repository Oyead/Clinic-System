import { useCallback, useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Notice, useNotice } from './Notice.jsx';
import { TokenReveal } from './SecretField.jsx';
import { StatusFilter } from './Appointments.jsx';

export function OwnerPanel() {
  const { token } = useAuth();
  const [notice, notify] = useNotice();
  const [clinics, setClinics] = useState([]);
  const [clinicId, setClinicId] = useState('');
  const [staff, setStaff] = useState(null);
  const [invites, setInvites] = useState(null);
  const [queue, setQueue] = useState(null);
  const [status, setStatus] = useState('');
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'doctor', name: '', specialization: '' });
  const [lastToken, setLastToken] = useState('');
  const [reportRange, setReportRange] = useState({ from: '', to: '' });
  const [report, setReport] = useState(null);

  const ownerApi = useCallback(
    (path, options) => api.owner(token, path, options),
    [token],
  );

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

  const loadQueue = useCallback(async (id, statusFilter) => {
    if (!id) return;
    try {
      const res = await ownerApi(`/clinics/${id}/appointments${statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ''}`);
      if (!res.ok) {
        notify(await readError(res, 'Showing queue failed.'), 'error');
        return;
      }
      const data = await res.json();
      setQueue(data.appointments);
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [ownerApi, notify]);

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
    loadQueue(clinicId, status);
  }, [clinicId, loadStaff, loadInvites, loadQueue]);

  const reloadAll = () => {
    if (!clinicId) return;
    loadStaff(clinicId);
    loadInvites(clinicId);
    loadQueue(clinicId, status);
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
    if (!window.confirm('Revoke this invite? The never-activated account is offboarded and the email freed.')) return;
    try {
      const res = await ownerApi(`/clinics/${clinicId}/invites/${inviteId}`, { method: 'DELETE' });
      if (res.ok) {
        notify('Invite revoked.', 'success');
        loadStaff(clinicId);
        loadInvites(clinicId);
      } else {
        notify(await readError(res, 'Revoking invite failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const suspendStaff = async (userId) => {
    if (!window.confirm(`Suspend staff #${userId}? They lose access until reinstated or offboarded.`)) return;
    try {
      const res = await ownerApi(`/clinics/${clinicId}/staff/${userId}/suspend`, { method: 'POST' });
      if (res.ok) {
        notify('Staff suspended.', 'success');
        loadStaff(clinicId);
      } else {
        notify(await readError(res, 'Suspending staff failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const offboardStaff = async (userId) => {
    if (!window.confirm(`Offboard staff #${userId}? Clean departure: access removed, email anonymized and freed.`)) return;
    try {
      const res = await ownerApi(`/clinics/${clinicId}/staff/${userId}/offboard`, { method: 'POST' });
      if (res.ok) {
        notify('Staff offboarded.', 'success');
        loadStaff(clinicId);
      } else {
        notify(await readError(res, 'Offboarding staff failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const decide = async (id, decision) => {
    try {
      const res = await ownerApi(`/appointments/${id}/${decision}`, { method: 'PATCH' });
      if (res.ok) {
        const data = await res.json();
        notify(data.message || `Appointment ${decision}d.`, 'success');
        loadQueue(clinicId, status);
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
        loadQueue(clinicId, status);
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
    <section className="card">
      <h2><span className="eyebrow">Clinic owner</span>My clinics</h2>
      <Notice notice={notice} />
      <div className="row">
        <select value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
          {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status && c.status !== 'active' ? ` (${c.status})` : ''}</option>)}
        </select>
        <button type="button" onClick={reloadAll}>Show</button>
      </div>
      {clinicLocked && (
        <p className="muted" role="status">
          This clinic is pending platform verification. Staff invites unlock after an admin approves it.
        </p>
      )}

      <h3>Staff</h3>
      <div>
        {staff === null ? <p className="muted">Not shown yet.</p>
          : staff.length === 0 ? <p className="muted">No staff yet. Send the first invite below.</p>
          : staff.map((s) => (
            <div className="user-row" key={s.user_id}>
              <span className="who">{s.email}<br />{s.role}{s.role === 'doctor' ? ` (${s.specialization || ''})` : ''} · {s.status || (s.is_active ? 'active' : 'inactive')}</span>
              {s.status === 'active' && (
                <button type="button" onClick={() => suspendStaff(s.user_id)}>Suspend</button>
              )}
              {(s.status === 'active' || s.status === 'suspended') && (
                <button type="button" className="remove" onClick={() => offboardStaff(s.user_id)}>Offboard</button>
              )}
            </div>
          ))}
      </div>

      <h3>Invite staff</h3>
      <p className="hint">Owners invite doctors and receptionists. They set their own password via Accept invite — changing clinics always means offboard-and-reinvite, never an edit.</p>
      <form noValidate onSubmit={submitInvite} id="form-owner-staff">
        <label>Email<input type="email" required value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} /></label>
        <label>Role
          <select value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="doctor">doctor</option>
            <option value="receptionist">receptionist</option>
          </select>
        </label>
        <label>Name<input type="text" required value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} /></label>
        <label>Specialization (doctors only)<input type="text" value={inviteForm.specialization} onChange={(e) => setInviteForm((f) => ({ ...f, specialization: e.target.value }))} /></label>
        <button type="submit" disabled={clinicLocked}>Send invite</button>
      </form>
      {lastToken && (
        <TokenReveal token={lastToken} title="Latest invite token — share it with the invitee" />
      )}

      <h3>Pending invites</h3>
      <div>
        {invites === null ? <p className="muted">Not shown yet.</p>
          : invites.filter((i) => !i.accepted_at && !i.revoked_at).length === 0
            ? <p className="muted">No pending invites.</p>
            : invites.filter((i) => !i.accepted_at && !i.revoked_at).map((i) => (
              <div className="user-row" key={i.id}>
                <span className="who">{i.user_email}<br />{i.role} · expires {new Date(i.expires_at).toLocaleString()}</span>
                <button type="button" onClick={() => resendInvite(i.id)}>Resend</button>
                <button type="button" className="remove" onClick={() => revokeInvite(i.id)}>Revoke</button>
              </div>
            ))}
      </div>

      <h3>Appointment requests</h3>
      <div className="row">
        <StatusFilter id="owner-status" value={status} onChange={setStatus} />
      </div>
      <p>Approve or reject pending requests, or cancel scheduled ones.</p>
      <div>
        {queue === null ? <p className="muted">Not shown yet.</p>
          : queue.length === 0 ? <p className="muted">No appointments at this clinic.</p>
          : queue.map((a) => (
            <div className="user-row" key={a.id}>
              <span className="who">#{a.id} {a.patient_name || ''} → {a.doctor_name || ''}<br />{new Date(a.appointment_date).toLocaleString()} · {a.status}</span>
              {a.status === 'pending' && (
                <>
                  <button type="button" className="approve" onClick={() => decide(a.id, 'approve')}>Approve</button>
                  <button type="button" className="reject" onClick={() => decide(a.id, 'reject')}>Reject</button>
                </>
              )}
              {(a.status === 'pending' || a.status === 'scheduled') && (
                <button type="button" onClick={() => cancel(a.id)}>Cancel</button>
              )}
            </div>
          ))}
      </div>

      <h3>Reports</h3>
      <div className="row">
        <label>From <input type="date" value={reportRange.from} onChange={(e) => setReportRange((r) => ({ ...r, from: e.target.value }))} /></label>
        <label>To <input type="date" value={reportRange.to} onChange={(e) => setReportRange((r) => ({ ...r, to: e.target.value }))} /></label>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" onClick={loadApptReport}>Appointments report</button>
        <button type="button" onClick={loadBillingReport}>Billing report</button>
      </div>
      <div>
        {report === null ? <p className="muted">Not shown yet.</p>
          : report.type === 'appointments' ? (
            <>
              <h4>By status</h4>
              <ReportTable headers={['Status', 'Count']} rows={report.data.by_status.map((r) => [r.status, r.count])} />
              <h4>Per doctor</h4>
              <ReportTable headers={['Doctor', 'Status', 'Count']} rows={report.data.per_doctor.map((r) => [r.doctor_name, r.status, r.count])} />
            </>
          ) : (
            <>
              <h4>Overall: {report.data.overall.bills} bills, total {report.data.overall.total}</h4>
              <ReportTable headers={['Payment status', 'Bills', 'Total']} rows={report.data.by_payment_status.map((r) => [r.payment_status || '—', r.bills, r.total])} />
            </>
          )}
      </div>
    </section>
  );
}

function ReportTable({ headers, rows }) {
  return (
    <div className="table-scroll">
      <table className="report-table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
