import { useCallback, useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth, ROLES } from '../context/AuthContext.jsx';
import { Notice, useNotice } from './Notice.jsx';
import { PasswordInput, TokenReveal } from './SecretField.jsx';
import { AppointmentList, StatusFilter } from './Appointments.jsx';

const initialFilters = {
  role: '',
  status: '',
  unlinkedOnly: false,
  queueStatus: '',
};

const initialData = {
  users: null,
  usersLoading: false,
  audit: null,
  patients: null,
  queue: null,
  pendingClinics: null,
};

const initialForms = {
  clinic: { name: '', phone_number: '', address: '', email: '' },
  admin: { email: '', password: '' },
  invite: { email: '', role: 'doctor', name: '', clinic_id: '', specialization: '' },
  reinstate: {},
  link: { patient_id: '', user_id: '' },
};

export function AdminPanel() {
  const { token } = useAuth();
  const [notice, notify] = useNotice();
  const [inviteToken, setInviteToken] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(initialData);
  const [forms, setForms] = useState(initialForms);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const updateData = useCallback((key, value) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleFormChange = (formName, e) => {
    const { name, value } = e.target;
    setForms((prev) => ({ ...prev, [formName]: { ...prev[formName], [name]: value } }));
  };

  const resetForm = (formName) => {
    setForms((prev) => ({ ...prev, [formName]: { ...initialForms[formName] } }));
  };

  const { role: roleFilter, status: statusFilter, unlinkedOnly, queueStatus } = filters;
  const { users, usersLoading, audit, patients, queue, pendingClinics } = data;
  const { clinic: clinicForm, admin: adminForm, invite: inviteForm, link: linkForm } = forms;

  const loadUsers = useCallback(async () => {
    updateData('usersLoading', true);
    try {
      const res = await api.adminUsers(token, roleFilter, statusFilter);
      if (!res.ok) {
        notify(await readError(res, 'Showing users failed.'), 'error');
        updateData('users', null);
        return;
      }
      const payload = await res.json();
      updateData('users', payload.users);
    } catch (err) {
      notify(err.message, 'error');
      updateData('users', null);
    } finally {
      updateData('usersLoading', false);
    }
  }, [token, roleFilter, statusFilter, notify, updateData]);

  const loadQueue = useCallback(async () => {
    try {
      const res = await api.appointments(token, queueStatus);
      if (!res.ok) {
        notify(await readError(res, 'Showing appointments failed.'), 'error');
        updateData('queue', null);
        return;
      }
      const payload = await res.json();
      updateData('queue', payload.appointments);
    } catch (err) {
      notify(err.message, 'error');
      updateData('queue', null);
    }
  }, [token, queueStatus, notify, updateData]);

  const loadPendingClinics = useCallback(async () => {
    try {
      const res = await api.adminClinics(token, 'pending_verification');
      if (!res.ok) {
        notify(await readError(res, 'Showing pending clinics failed.'), 'error');
        updateData('pendingClinics', null);
        return;
      }
      const payload = await res.json();
      updateData('pendingClinics', payload.clinics);
    } catch (err) {
      notify(err.message, 'error');
      updateData('pendingClinics', null);
    }
  }, [token, notify, updateData]);

  useEffect(() => {
    loadQueue();
    loadPendingClinics();
  }, [loadQueue, loadPendingClinics]);

  const approveClinic = async (id) => {
    try {
      const res = await api.adminApproveClinic(token, id);
      if (res.ok) {
        notify('Clinic approved. Owner can now invite staff.', 'success');
        loadPendingClinics();
      } else {
        notify(await readError(res, 'Approving clinic failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const suspendUser = async (id) => {
    if (!window.confirm(`Suspend user #${id}? Email stays blocked until reinstated or offboarded.`)) return;
    try {
      const res = await api.adminSuspendUser(token, id);
      if (res.ok) {
        notify('User suspended.', 'success');
        loadUsers();
      } else {
        notify(await readError(res, 'Suspending user failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const reinstateUser = async (id) => {
    const password = window.prompt(`New password for user #${id} (min 8 characters)?`);
    if (!password) return;
    try {
      const res = await api.adminReinstateUser(token, id, password);
      if (res.ok) {
        notify('User reinstated with a fresh password.', 'success');
        loadUsers();
      } else {
        notify(await readError(res, 'Reinstating user failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const offboardUser = async (id) => {
    if (!window.confirm(`Offboard user #${id}? Clean departure: email anonymized and freed.`)) return;
    try {
      const res = await api.adminOffboardUser(token, id);
      if (res.ok) {
        notify('User offboarded.', 'success');
        loadUsers();
      } else {
        notify(await readError(res, 'Offboarding user failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const decide = async (id, decision) => {
    try {
      const res = await api.decideAppointment(token, id, decision);
      if (res.ok) {
        const payload = await res.json();
        notify(payload.message || `Appointment ${decision}d.`, 'success');
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

  const submitClinic = async (e) => {
    e.preventDefault();
    try {
      const res = await api.adminCreateClinic(token, clinicForm);
      if (res.status === 201) {
        const payload = await res.json();
        notify(`Clinic created: ${payload.clinic.name} (#${payload.clinic.id}).`, 'success');
        resetForm('clinic');
        loadPendingClinics();
      } else {
        notify(await readError(res, 'Creating clinic failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const submitAdmin = async (e) => {
    e.preventDefault();
    if (!adminForm.email.trim() || !adminForm.password) {
      notify('Email and password are required.', 'error');
      return;
    }
    try {
      const res = await api.adminCreateAdmin(token, { email: adminForm.email.trim(), password: adminForm.password });
      if (res.status === 201) {
        const payload = await res.json();
        notify(`Admin created: ${payload.user.email}.`, 'success');
        resetForm('admin');
        loadUsers();
      } else {
        notify(await readError(res, 'Creating admin failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const submitInvite = async (e) => {
    e.preventDefault();
    const body = {
      email: inviteForm.email.trim(),
      role: inviteForm.role,
      name: inviteForm.name.trim(),
      clinic_id: Number(inviteForm.clinic_id),
      ...(inviteForm.specialization.trim() ? { specialization: inviteForm.specialization.trim() } : {}),
    };
    if (!body.email || !body.name || !body.clinic_id) {
      notify('Email, name, and clinic ID are required.', 'error');
      return;
    }
    try {
      const res = await api.adminInviteStaff(token, body);
      const payload = await res.json().catch(() => ({}));
      if (res.status === 201) {
        notify('Invite created.', 'success');
        setInviteToken(payload.inviteToken || null);
        resetForm('invite');
      } else {
        notify(payload.error || 'Creating invite failed.', 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const loadPatients = async () => {
    try {
      const res = await api.adminPatients(token, unlinkedOnly);
      if (!res.ok) {
        notify(await readError(res, 'Showing patients failed.'), 'error');
        updateData('patients', null);
        return;
      }
      const payload = await res.json();
      updateData('patients', payload.patients);
    } catch (err) {
      notify(err.message, 'error');
      updateData('patients', null);
    }
  };

  const submitLink = async (e) => {
    e.preventDefault();
    try {
      const res = await api.adminLinkPatient(token, linkForm.patient_id, Number(linkForm.user_id));
      if (res.ok) {
        notify('Patient linked to user.', 'success');
        resetForm('link');
        loadPatients();
      } else {
        notify(await readError(res, 'Linking patient failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const loadAudit = async () => {
    try {
      const res = await api.adminAuditLogs(token);
      if (!res.ok) {
        notify(await readError(res, 'Showing audit log failed.'), 'error');
        updateData('audit', null);
        return;
      }
      const payload = await res.json();
      updateData('audit', payload.audit_logs);
    } catch (err) {
      notify(err.message, 'error');
      updateData('audit', null);
    }
  };

  return (
    <section className="card">
      <h2><span className="eyebrow">Administration</span>Console</h2>
      <Notice notice={notice} />

      <h3>Clinic approvals <span className="hint">PATCH /api/v1/admin/clinics/:id/approve</span></h3>
      <div className="row"><button type="button" onClick={loadPendingClinics}>Show pending clinics</button></div>
      <div>
        {pendingClinics === null ? <p className="muted">Not shown yet.</p>
          : pendingClinics.length === 0 ? <p className="muted">No clinics awaiting verification.</p>
          : pendingClinics.map((c) => (
            <div className="user-row" key={c.id}>
              <span className="who">#{c.id} {c.name}<br />{c.address} · owner: {c.owner_email || `#${c.owner_id ?? '—'}`}</span>
              <button type="button" className="approve" onClick={() => approveClinic(c.id)}>Approve</button>
            </div>
          ))}
      </div>

      <h3>Clinics <span className="hint">POST /api/v1/admin/clinics</span></h3>
      <form className="profile-fields" noValidate onSubmit={submitClinic}>
        <label>Name<input name="name" required placeholder="e.g. Downtown Clinic" value={clinicForm.name} onChange={(e) => handleFormChange('clinic', e)} /></label>
        <label>Phone number<input name="phone_number" required placeholder="e.g. +1-555-0100" value={clinicForm.phone_number} onChange={(e) => handleFormChange('clinic', e)} /></label>
        <label>Address<input name="address" required placeholder="e.g. 123 Main St" value={clinicForm.address} onChange={(e) => handleFormChange('clinic', e)} /></label>
        <label>Email<input name="email" type="email" required placeholder="e.g. clinic@example.com" value={clinicForm.email} onChange={(e) => handleFormChange('clinic', e)} /></label>
        <button type="submit">Create clinic</button>
      </form>

      <h3>Create admin <span className="hint">POST /api/v1/admin/admins</span></h3>
      <p className="hint">Admins have no signup path — additional admins are created here only, by an existing admin.</p>
      <form className="profile-fields" noValidate onSubmit={submitAdmin}>
        <label>Email<input name="email" type="email" required value={adminForm.email} onChange={(e) => handleFormChange('admin', e)} /></label>
        <label>Password (min 8 characters)<PasswordInput name="password" required minLength={8} value={adminForm.password} onChange={(e) => handleFormChange('admin', e)} /></label>
        <button type="submit">Create admin</button>
      </form>

      <h3>Invite staff (support override) <span className="hint">POST /api/v1/admin/staff/invite</span></h3>
      <p className="hint">Normally owners invite their own staff. Admins use this only for support. Role derives from this endpoint — never from client-editable role fields.</p>
      <form className="profile-fields" noValidate onSubmit={submitInvite}>
        <label>Email<input name="email" type="email" required value={inviteForm.email} onChange={(e) => handleFormChange('invite', e)} /></label>
        <label>Role
          <select name="role" value={inviteForm.role} onChange={(e) => handleFormChange('invite', e)}>
            <option value="doctor">doctor</option>
            <option value="receptionist">receptionist</option>
            <option value="clinic_owner">clinic_owner</option>
          </select>
        </label>
        <label>Full name<input name="name" type="text" required value={inviteForm.name} onChange={(e) => handleFormChange('invite', e)} /></label>
        <label>Clinic ID<input name="clinic_id" type="number" min={1} required value={inviteForm.clinic_id} onChange={(e) => handleFormChange('invite', e)} /></label>
        <label>Specialization (doctors only)<input name="specialization" type="text" value={inviteForm.specialization} onChange={(e) => handleFormChange('invite', e)} /></label>
        <button type="submit">Send invite</button>
      </form>
      {inviteToken && (
        <TokenReveal token={inviteToken} title="Staff invite token — share it with the invitee" />
      )}

      <h3>Users <span className="hint">GET /api/v1/admin/users · lifecycle: suspend / reinstate / offboard</span></h3>
      <p className="hint">Roles derive from signup/invite flows and are never edited in place. Moving a staffer between clinics means offboard-and-reinvite.</p>
      <div className="row">
        <button type="button" onClick={loadUsers}>Show users</button>
        <button type="button" onClick={loadAudit}>Show audit log</button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label style={{ flex: 1 }}>Role filter
          <select value={roleFilter} onChange={(e) => updateFilter('role', e.target.value)}>
            <option value="">all roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label style={{ flex: 1 }}>Status filter
          <select value={statusFilter} onChange={(e) => updateFilter('status', e.target.value)}>
            <option value="">all statuses</option>
            <option value="pending_verification">pending_verification</option>
            <option value="invited">invited</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="offboarded">offboarded</option>
          </select>
        </label>
      </div>
      <div>
        {usersShowing ? <p className="muted">Showing…</p>
          : users === null ? <p className="muted">Not shown yet.</p>
          : users.length === 0 ? <p className="muted">No users found.</p>
          : <UserRows users={users} onSuspend={suspendUser} onReinstate={reinstateUser} onOffboard={offboardUser} />}
      </div>

      <h3>Patients <span className="hint">GET /api/v1/admin/patients · PUT /api/v1/admin/patients/:id/link-user</span></h3>
      <div className="row"><button type="button" onClick={loadPatients}>Show patients</button></div>
      <div className="row" style={{ marginTop: 8 }}>
        <label style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={unlinkedOnly} onChange={(e) => updateFilter('unlinkedOnly', e.target.checked)} /> Only unlinked
        </label>
      </div>
      <div>
        {patients === null ? <p className="muted">Not shown yet.</p>
          : patients.length === 0 ? <p className="muted">No patients found.</p>
          : patients.map((p) => (
            <div className="audit-row" key={p.id}>#{p.id} {p.name || '—'} &lt;{p.email || '—'}&gt; user:{p.user_id ?? 'unlinked'}</div>
          ))}
      </div>
      <form className="profile-fields" noValidate onSubmit={submitLink}>
        <label>Patient ID<input name="patient_id" type="number" min={1} required value={linkForm.patient_id} onChange={(e) => handleFormChange('link', e)} /></label>
        <label>User ID (must have role patient)<input name="user_id" type="number" min={1} required value={linkForm.user_id} onChange={(e) => handleFormChange('link', e)} /></label>
        <button type="submit">Link patient to user</button>
      </form>

      <h3>Audit log <span className="hint">GET /api/v1/admin/audit-logs</span></h3>
      <div>
        {audit === null ? <p className="muted">Not shown yet.</p>
          : audit.length === 0 ? <p className="muted">No audit entries yet.</p>
          : audit.map((l, i) => {
            const subject = l.target_email || (l.appointment_id ? `appointment #${l.appointment_id}` : '—');
            return (
              <div className="audit-row" key={i}>
                {l.action}: {subject} {l.old_role || l.old_status || '—'} → {l.new_role || l.new_status || '—'}
                {l.clinic_id ? ` @ clinic #${l.clinic_id}` : ''} (by {l.performed_by === null ? 'system' : `#${l.performed_by}`})
              </div>
            );
          })}
      </div>

      <h3>All appointments <span className="hint">GET /api/v1/appointments/ (admin sees all)</span></h3>
      <div className="row">
        <StatusFilter id="admin-appt-status" value={queueStatus} onChange={(value) => updateFilter('queueStatus', value)} />
        <button type="button" style={{ alignSelf: 'flex-end' }} onClick={loadQueue}>Show appointments</button>
      </div>
      <p className="hint">approve: PATCH /api/v1/appointments/:id/approve · reject: PATCH /api/v1/appointments/:id/reject · cancel: PATCH /api/v1/appointments/:id/cancel</p>
      <div>{queue === null ? <p className="muted">Not shown yet.</p> : <AppointmentList appointments={queue} emptyText="No appointments yet." onDecide={decide} onCancel={cancel} />}</div>
    </section>
  );
}

function UserRows({ users, onSuspend, onReinstate, onOffboard }) {
  return (
    <>
      {users.map((u) => (
        <div className="user-row" key={u.id}>
          <span className="who">#{u.id} {u.email}<br />{u.role} · {u.status || (u.is_active ? 'active' : 'inactive')}</span>
          {u.status === 'active' && (
            <button type="button" onClick={() => onSuspend(u.id)}>Suspend</button>
          )}
          {u.status === 'suspended' && (
            <>
              <button type="button" className="approve" onClick={() => onReinstate(u.id)}>Reinstate</button>
              <button type="button" className="reject" onClick={() => onOffboard(u.id)}>Offboard</button>
            </>
          )}
          {(u.status === 'active' || u.status === 'pending_verification') && (
            <button type="button" className="remove" onClick={() => onOffboard(u.id)}>Offboard</button>
          )}
        </div>
      ))}
    </>
  );
}
