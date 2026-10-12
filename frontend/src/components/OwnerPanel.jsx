import { useCallback, useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusFilter } from './Appointments.jsx';

export function OwnerPanel() {
  const { token, showMessage } = useAuth();
  const [clinics, setClinics] = useState([]);
  const [clinicId, setClinicId] = useState('');
  const [staff, setStaff] = useState(null);
  const [queue, setQueue] = useState(null);
  const [status, setStatus] = useState('');
  const [staffForm, setStaffForm] = useState({ email: '', password: '', role: 'doctor', name: '', specialization: '' });
  const [reportRange, setReportRange] = useState({ from: '', to: '' });
  const [report, setReport] = useState(null);

  const ownerApi = useCallback(
    (path, options) => api.owner(token, path, options),
    [token],
  );

  const loadStaff = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await ownerApi(`/clinics/${id}/staff`);
      if (!res.ok) {
        showMessage(await readError(res, 'Loading staff failed.'), 'error');
        return;
      }
      const data = await res.json();
      setStaff(data.staff);
    } catch (err) {
      showMessage(err.message, 'error');
    }
  }, [ownerApi, showMessage]);

  const loadQueue = useCallback(async (id, statusFilter) => {
    if (!id) return;
    try {
      const res = await ownerApi(`/clinics/${id}/appointments${statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ''}`);
      if (!res.ok) {
        showMessage(await readError(res, 'Loading queue failed.'), 'error');
        return;
      }
      const data = await res.json();
      setQueue(data.appointments);
    } catch (err) {
      showMessage(err.message, 'error');
    }
  }, [ownerApi, showMessage]);

  const loadClinics = useCallback(async () => {
    try {
      const res = await ownerApi('/clinics');
      if (!res.ok) {
        showMessage(await readError(res, 'Loading clinics failed.'), 'error');
        return;
      }
      const data = await res.json();
      setClinics(data.clinics);
      if (!data.clinics.length) {
        showMessage('No clinics assigned to your account yet.', 'error');
        return;
      }
      setClinicId((prev) => prev || String(data.clinics[0].id));
    } catch (err) {
      showMessage(err.message, 'error');
    }
  }, [ownerApi, showMessage]);

  useEffect(() => {
    loadClinics();
  }, [loadClinics]);

  useEffect(() => {
    if (!clinicId) return;
    loadStaff(clinicId);
    loadQueue(clinicId, status);
  }, [clinicId, loadStaff, loadQueue]);

  const reloadAll = () => {
    if (!clinicId) return;
    loadStaff(clinicId);
    loadQueue(clinicId, status);
  };

  const submitStaff = async (e) => {
    e.preventDefault();
    const { email, password, role, name, specialization } = staffForm;
    if (!email.trim() || !password || !name.trim()) {
      showMessage('Email, password, and name are required.', 'error');
      return;
    }
    try {
      const res = await ownerApi(`/clinics/${clinicId}/staff`, {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          role,
          name: name.trim(),
          ...(specialization.trim() ? { specialization: specialization.trim() } : {}),
        }),
      });
      if (res.status === 201) {
        showMessage('Staff account created.', 'success');
        setStaffForm({ email: '', password: '', role: 'doctor', name: '', specialization: '' });
        loadStaff(clinicId);
      } else {
        showMessage(await readError(res, 'Creating staff failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const removeStaff = async (userId) => {
    try {
      const res = await ownerApi(`/clinics/${clinicId}/staff/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('Staff account deactivated.', 'success');
        loadStaff(clinicId);
      } else {
        showMessage(await readError(res, 'Removing staff failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const decide = async (id, decision) => {
    try {
      const res = await ownerApi(`/appointments/${id}/${decision}`, { method: 'PATCH' });
      if (res.ok) {
        const data = await res.json();
        showMessage(data.message || `Appointment ${decision}d.`, 'success');
        loadQueue(clinicId, status);
      } else {
        showMessage(await readError(res, `${decision} failed.`), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const cancel = async (id) => {
    try {
      const res = await api.cancelAppointment(token, id);
      if (res.ok) {
        showMessage('Appointment cancelled.', 'success');
        loadQueue(clinicId, status);
      } else {
        showMessage(await readError(res, 'Cancellation failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
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
        showMessage(await readError(res, 'Loading report failed.'), 'error');
        return;
      }
      const data = await res.json();
      setReport({ type: 'appointments', data });
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const loadBillingReport = async () => {
    try {
      const res = await ownerApi(`/clinics/${clinicId}/reports/billing${reportQuery()}`);
      if (!res.ok) {
        showMessage(await readError(res, 'Loading report failed.'), 'error');
        return;
      }
      const data = await res.json();
      setReport({ type: 'billing', data });
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  return (
    <section className="card">
      <h2><span className="eyebrow">Practice owner</span>My clinics</h2>
      <div className="row">
        <select value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
          {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="button" onClick={reloadAll}>Load</button>
      </div>

      <h3>Staff</h3>
      <div>
        {staff === null ? <p className="muted">Not loaded yet.</p>
          : staff.length === 0 ? <p className="muted">No staff yet. Add the first below.</p>
          : staff.map((s) => (
            <div className="user-row" key={s.user_id}>
              <span className="who">{s.email}<br />{s.role}{s.role === 'doctor' ? ` (${s.specialization || ''})` : ''}{s.is_active ? '' : ' (inactive)'}</span>
              <button type="button" className="remove" disabled={!s.is_active} onClick={() => removeStaff(s.user_id)}>Remove</button>
            </div>
          ))}
      </div>
      <form noValidate onSubmit={submitStaff} id="form-owner-staff">
        <label>Email<input type="email" required value={staffForm.email} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} /></label>
        <label>Password (min 8 characters)<input type="password" required minLength={8} value={staffForm.password} onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))} /></label>
        <label>Role
          <select value={staffForm.role} onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="doctor">doctor</option>
            <option value="receptionist">receptionist</option>
          </select>
        </label>
        <label>Name<input type="text" required value={staffForm.name} onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))} /></label>
        <label>Specialization (doctors only)<input type="text" value={staffForm.specialization} onChange={(e) => setStaffForm((f) => ({ ...f, specialization: e.target.value }))} /></label>
        <button type="submit">Add staff</button>
      </form>

      <h3>Appointment requests</h3>
      <div className="row">
        <StatusFilter id="owner-status" value={status} onChange={setStatus} />
      </div>
      <p>Approve or reject pending requests, or cancel scheduled ones.</p>
      <div>
        {queue === null ? <p className="muted">Not loaded yet.</p>
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
        {report === null ? <p className="muted">Not loaded yet.</p>
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
    <table className="report-table">
      <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}
