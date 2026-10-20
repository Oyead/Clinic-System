import { useCallback, useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth, ROLES } from '../context/AuthContext.jsx';
import { Notice, useNotice } from './Notice.jsx';
import { ConfirmDialog, PasswordDialog } from './ConfirmDialog.jsx';
import { PasswordInput, TokenReveal } from './SecretField.jsx';
import { AppointmentList, StatusFilter } from './Appointments.jsx';
import { PanelTabs, usePersistentTab } from './Tabs.jsx';
import { FORM_INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_SUCCESS, BTN_SUCCESS_INK, BTN_DANGER, EYEBROW, SECTION_TITLE, statusPill } from './ui.js';

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

const ADMIN_TABS = [
  { id: 'clinics', label: 'Clinics' },
  { id: 'admins', label: 'Admins' },
  { id: 'invites', label: 'Staff invites' },
  { id: 'users', label: 'Users' },
  { id: 'patients', label: 'Patients' },
  { id: 'audit', label: 'Audit log' },
  { id: 'appointments', label: 'Appointments' },
];

export function AdminPanel() {
  const { token } = useAuth();
  const [notice, notify, dismissNotice] = useNotice();
  const [inviteToken, setInviteToken] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(initialData);
  const [forms, setForms] = useState(initialForms);
  const [tab, setTab] = usePersistentTab('clinic.tab.admin', 'clinics', ADMIN_TABS.map((t) => t.id));
  const [confirm, setConfirm] = useState(null);
  const [reinstateId, setReinstateId] = useState(null);
  const [busy, setBusy] = useState(false);

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
    setConfirm({ action: 'suspend', id });
  };

  const reinstateUser = async (id) => {
    setReinstateId(id);
  };

  const offboardUser = async (id) => {
    setConfirm({ action: 'offboard', id });
  };

  const handleConfirmAction = async () => {
    if (!confirm) return;
    const { action, id } = confirm;
    setBusy(true);
    try {
      const res = action === 'suspend'
        ? await api.adminSuspendUser(token, id)
        : await api.adminOffboardUser(token, id);
      if (res.ok) {
        notify(action === 'suspend' ? 'User suspended.' : 'User offboarded.', 'success');
        loadUsers();
      } else {
        notify(await readError(res, action === 'suspend' ? 'Suspending user failed.' : 'Offboarding user failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const handleReinstateSubmit = async (password) => {
    if (reinstateId === null) return;
    setBusy(true);
    try {
      const res = await api.adminReinstateUser(token, reinstateId, password);
      if (res.ok) {
        notify('User reinstated with a fresh password.', 'success');
        loadUsers();
        setReinstateId(null);
      } else {
        notify(await readError(res, 'Reinstating user failed.'), 'error');
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
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
    <section className="rounded-[24px] bg-white p-4 shadow-[var(--shadow)] sm:p-7">
      <div>
        <span className={EYEBROW}>Administration</span>
        <h2 className="mt-1.5 font-display text-[1.8rem] font-extrabold leading-tight tracking-[-0.04em] text-[var(--color-ink)]">Console</h2>
      </div>
      <Notice notice={notice} onClose={dismissNotice} />
      <div className="mt-5">
        <PanelTabs tabs={ADMIN_TABS} active={tab} onChange={setTab} label="Admin sections" />
      </div>

      {tab === 'clinics' && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className={SECTION_TITLE}>Clinic approvals</h3>
              <p className={`${EYEBROW} mt-1.5`}>PATCH /api/v1/admin/clinics/:id/approve</p>
            </div>
            <button type="button" className={`${BTN_SECONDARY} px-4 py-2 text-xs`} onClick={loadPendingClinics}>Show pending clinics</button>
          </div>
          <div className="mt-3">
            {pendingClinics === null ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Not shown yet.</p>
              : pendingClinics.length === 0 ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">No clinics awaiting verification.</p>
              : (
                <div className="flex flex-col divide-y divide-[var(--color-line)]">
                  {pendingClinics.map((c) => (
                    <div className="flex flex-wrap items-center gap-3 py-3.5 text-sm" key={c.id}>
                      <span className="min-w-0 flex-1 leading-[1.6] text-[var(--color-ink)] [overflow-wrap:anywhere]">
                        <span className="font-bold">#{c.id} {c.name}</span><br />
                        <span className="text-[0.8rem] text-[var(--color-ink-soft)]">{c.address} · owner: {c.owner_email || `#${c.owner_id ?? '-'}`}</span>
                      </span>
                      <span className={statusPill('pending_verification')}>pending</span>
                      <button type="button" className={`${BTN_SUCCESS} w-full px-4 py-1.5 text-xs sm:w-auto`} onClick={() => approveClinic(c.id)}>Approve</button>
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div className="mt-7 flex flex-wrap items-end justify-between gap-2">
            <h3 className={SECTION_TITLE}>Create clinic</h3>
            <p className={EYEBROW}>POST /api/v1/admin/clinics</p>
          </div>
          <form className="mt-3 grid gap-3 rounded-[20px] bg-[var(--color-sand)] p-4 sm:grid-cols-2" noValidate onSubmit={submitClinic}>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Name
              <input name="name" required placeholder="e.g. Downtown Clinic" className={`${FORM_INPUT} bg-white`} value={clinicForm.name} onChange={(e) => handleFormChange('clinic', e)} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Phone number
              <input name="phone_number" required placeholder="e.g. +1-555-0100" className={`${FORM_INPUT} bg-white`} value={clinicForm.phone_number} onChange={(e) => handleFormChange('clinic', e)} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Address
              <input name="address" required placeholder="e.g. 123 Main St" className={`${FORM_INPUT} bg-white`} value={clinicForm.address} onChange={(e) => handleFormChange('clinic', e)} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Email
              <input name="email" type="email" required placeholder="e.g. clinic@example.com" className={`${FORM_INPUT} bg-white`} value={clinicForm.email} onChange={(e) => handleFormChange('clinic', e)} />
            </label>
            <button type="submit" className={`${BTN_PRIMARY} w-fit px-6 py-2.5 text-sm sm:col-span-2`}>Create clinic</button>
          </form>
        </>
      )}

      {tab === 'admins' && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-2">
            <h3 className={SECTION_TITLE}>Create admin</h3>
            <p className={EYEBROW}>POST /api/v1/admin/admins</p>
          </div>
          <p className="mt-1.5 text-[0.82rem] leading-[1.65] text-[var(--color-ink-soft)]">Admins have no signup path - additional admins are created here only, by an existing admin.</p>
          <form className="mt-3 flex flex-col gap-3 rounded-[20px] bg-[var(--color-sand)] p-4 sm:max-w-[480px]" noValidate onSubmit={submitAdmin}>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Email
              <input name="email" type="email" required className={`${FORM_INPUT} bg-white`} value={adminForm.email} onChange={(e) => handleFormChange('admin', e)} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Password (min 8 characters)
              <PasswordInput name="password" required minLength={8} className="bg-white" value={adminForm.password} onChange={(e) => handleFormChange('admin', e)} />
            </label>
            <button type="submit" className={`${BTN_PRIMARY} w-fit px-6 py-2.5 text-sm`}>Create admin</button>
          </form>
        </>
      )}

      {tab === 'invites' && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-2">
            <h3 className={SECTION_TITLE}>Invite staff <span className="text-[0.8rem] font-medium text-[var(--color-ink-soft)]">(support override)</span></h3>
            <p className={EYEBROW}>POST /api/v1/admin/staff/invite</p>
          </div>
          <p className="mt-1.5 text-[0.82rem] leading-[1.65] text-[var(--color-ink-soft)]">Normally owners invite their own staff. Admins use this only for support. Role derives from this endpoint - never from client-editable role fields.</p>
          <form className="mt-3 grid gap-3 rounded-[20px] bg-[var(--color-sand)] p-4 sm:grid-cols-2" noValidate onSubmit={submitInvite}>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Email
              <input name="email" type="email" required className={`${FORM_INPUT} bg-white`} value={inviteForm.email} onChange={(e) => handleFormChange('invite', e)} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Role
              <select name="role" value={inviteForm.role} onChange={(e) => handleFormChange('invite', e)} className={`${FORM_INPUT} bg-white`}>
                <option value="doctor">doctor</option>
                <option value="receptionist">receptionist</option>
                <option value="clinic_owner">clinic_owner</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Full name
              <input name="name" type="text" required className={`${FORM_INPUT} bg-white`} value={inviteForm.name} onChange={(e) => handleFormChange('invite', e)} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Clinic ID
              <input name="clinic_id" type="number" min={1} required className={`${FORM_INPUT} bg-white`} value={inviteForm.clinic_id} onChange={(e) => handleFormChange('invite', e)} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)] sm:col-span-2">
              Specialization <span className="font-medium text-[var(--color-ink-soft)]">doctors only</span>
              <input name="specialization" type="text" className={`${FORM_INPUT} bg-white`} value={inviteForm.specialization} onChange={(e) => handleFormChange('invite', e)} />
            </label>
            <button type="submit" className={`${BTN_PRIMARY} w-fit px-6 py-2.5 text-sm sm:col-span-2`}>Send invite</button>
          </form>
          {inviteToken && (
            <TokenReveal token={inviteToken} title="Staff invite token - share it with the invitee" />
          )}
        </>
      )}

      {tab === 'users' && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-2">
            <h3 className={SECTION_TITLE}>Users</h3>
            <p className={EYEBROW}>GET /api/v1/admin/users · lifecycle: suspend / reinstate / offboard</p>
          </div>
          <p className="mt-1.5 text-[0.82rem] leading-[1.65] text-[var(--color-ink-soft)]">Roles derive from signup/invite flows and are never edited in place. Moving a staffer between clinics means offboard-and-reinvite.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={`${BTN_SECONDARY} px-4 py-2 text-xs`} onClick={loadUsers}>Show users</button>
            <button type="button" className={`${BTN_SECONDARY} px-4 py-2 text-xs`} onClick={loadAudit}>Show audit log</button>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-col gap-1.5 text-[0.78rem] font-bold text-[var(--color-ink)] sm:flex-1">
              Role filter
              <select value={roleFilter} onChange={(e) => updateFilter('role', e.target.value)} className={FORM_INPUT}>
                <option value="">all roles</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[0.78rem] font-bold text-[var(--color-ink)] sm:flex-1">
              Status filter
              <select value={statusFilter} onChange={(e) => updateFilter('status', e.target.value)} className={FORM_INPUT}>
                <option value="">all statuses</option>
                <option value="pending_verification">pending_verification</option>
                <option value="invited">invited</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="offboarded">offboarded</option>
              </select>
            </label>
          </div>
          <div className="mt-3">
            {usersLoading ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Showing…</p>
              : users === null ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Not shown yet.</p>
              : users.length === 0 ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">No users found.</p>
              : <UserRows users={users} onSuspend={suspendUser} onReinstate={reinstateUser} onOffboard={offboardUser} />}
          </div>
        </>
      )}

      {tab === 'patients' && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-2">
            <h3 className={SECTION_TITLE}>Patients</h3>
            <p className={EYEBROW}>GET /api/v1/admin/patients · PUT /api/v1/admin/patients/:id/link-user</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={`${BTN_SECONDARY} px-4 py-2 text-xs`} onClick={loadPatients}>Show patients</button>
            <label className="flex items-center gap-2 text-[0.8rem] font-bold text-[var(--color-ink)]">
              <input type="checkbox" className="h-4 w-4 rounded accent-[var(--color-ink)]" checked={unlinkedOnly} onChange={(e) => updateFilter('unlinkedOnly', e.target.checked)} /> Only unlinked
            </label>
          </div>
          <div className="mt-3">
            {patients === null ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Not shown yet.</p>
              : patients.length === 0 ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">No patients found.</p>
              : (
                <div className="flex flex-col divide-y divide-[var(--color-line)]">
                  {patients.map((p) => (
                    <div className="py-2.5 text-[0.85rem] leading-[1.6] text-[var(--color-ink)] [overflow-wrap:anywhere]" key={p.id}>
                      <span className="font-bold">#{p.id}</span> {p.name || '-'} &lt;{p.email || '-'}&gt; <span className="text-[var(--color-ink-soft)]">user: {p.user_id ?? 'unlinked'}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
          <h4 className="mt-6 font-display text-[1.05rem] font-bold text-[var(--color-ink)]">Link patient to user</h4>
          <form className="mt-2 flex flex-col gap-3 rounded-[20px] bg-[var(--color-sand)] p-4 sm:max-w-[480px]" noValidate onSubmit={submitLink}>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              Patient ID
              <input name="patient_id" type="number" min={1} required className={`${FORM_INPUT} bg-white`} value={linkForm.patient_id} onChange={(e) => handleFormChange('link', e)} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.8rem] font-bold text-[var(--color-ink)]">
              User ID <span className="font-medium text-[var(--color-ink-soft)]">must have role patient</span>
              <input name="user_id" type="number" min={1} required className={`${FORM_INPUT} bg-white`} value={linkForm.user_id} onChange={(e) => handleFormChange('link', e)} />
            </label>
            <button type="submit" className={`${BTN_PRIMARY} w-fit px-6 py-2.5 text-sm`}>Link patient to user</button>
          </form>
        </>
      )}

      {tab === 'audit' && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-2">
            <h3 className={SECTION_TITLE}>Audit log</h3>
            <p className={EYEBROW}>GET /api/v1/admin/audit-logs</p>
          </div>
          <div className="mt-3">
            {audit === null ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Not shown yet.</p>
              : audit.length === 0 ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">No audit entries yet.</p>
              : (
                <div className="flex flex-col divide-y divide-[var(--color-line)]">
                  {audit.map((l, i) => {
                    const subject = l.target_email || (l.appointment_id ? `appointment #${l.appointment_id}` : '-');
                    return (
                      <div className="py-2.5 text-[0.85rem] leading-[1.6] text-[var(--color-ink)]" key={i}>
                        <span className="font-bold">{l.action}</span>: {subject} {l.old_role || l.old_status || '-'} → {l.new_role || l.new_status || '-'}
                        {l.clinic_id ? ` @ clinic #${l.clinic_id}` : ''} <span className="text-[var(--color-ink-soft)]">(by {l.performed_by === null ? 'system' : `#${l.performed_by}`})</span>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </>
      )}

      {tab === 'appointments' && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className={SECTION_TITLE}>All appointments</h3>
              <p className={`${EYEBROW} mt-1.5`}>GET /api/v1/appointments/ · admin sees all</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <StatusFilter id="admin-appt-status" value={queueStatus} onChange={(value) => updateFilter('queueStatus', value)} />
              <button type="button" className={`${BTN_SECONDARY} px-4 py-2 text-xs`} onClick={loadQueue}>Show appointments</button>
            </div>
          </div>
          <p className="mt-2 text-[0.76rem] leading-[1.6] text-[var(--color-ink-soft)]">approve: PATCH /api/v1/appointments/:id/approve · reject: PATCH /api/v1/appointments/:id/reject · cancel: PATCH /api/v1/appointments/:id/cancel</p>
          <div className="mt-3">{queue === null ? <p className="text-[0.85rem] font-medium text-[var(--color-ink-soft)]">Not shown yet.</p> : <AppointmentList appointments={queue} emptyText="No appointments yet." onDecide={decide} onCancel={cancel} />}</div>
        </>
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.action === 'suspend' ? `Suspend user #${confirm?.id}?` : `Offboard user #${confirm?.id}?`}
        message={confirm?.action === 'suspend'
          ? 'Email stays blocked until reinstated or offboarded.'
          : 'Clean departure: email anonymized and freed.'}
        confirmLabel={confirm?.action === 'suspend' ? 'Suspend user' : 'Offboard user'}
        danger
        busy={busy}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirm(null)}
      />
      <PasswordDialog
        open={reinstateId !== null}
        title={`New password for user #${reinstateId}?`}
        message="Minimum 8 characters. The user signs in with this password."
        busy={busy}
        onSubmit={handleReinstateSubmit}
        onCancel={() => setReinstateId(null)}
      />
    </section>
  );
}

function UserRows({ users, onSuspend, onReinstate, onOffboard }) {
  return (
    <div className="flex flex-col divide-y divide-[var(--color-line)]">
      {users.map((u) => {
        const state = u.status || (u.is_active ? 'active' : 'inactive');
        return (
          <div className="flex flex-wrap items-center gap-3 py-3.5 text-sm" key={u.id}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[var(--color-sand)] font-display text-[0.8rem] font-bold text-[var(--color-ink)] shadow-[var(--shadow-sm)]">
              {(u.email || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 leading-[1.6] text-[var(--color-ink)] [overflow-wrap:anywhere]">
              <span className="font-bold">#{u.id}</span> {u.email}<br />
              <span className="text-[0.8rem] text-[var(--color-ink-soft)]">{u.role}</span>{' '}
              <span className={statusPill(state)}>{state}</span>
            </span>
            <span className="flex w-full flex-wrap gap-2 sm:w-auto">
              {u.status === 'active' && (
                <button type="button" className={`${BTN_DANGER} px-3.5 py-1.5 text-xs`} onClick={() => onSuspend(u.id)}>Suspend</button>
              )}
              {u.status === 'suspended' && (
                <>
                  <button type="button" className={`${BTN_SUCCESS_INK} px-3.5 py-1.5 text-xs`} onClick={() => onReinstate(u.id)}>Reinstate</button>
                  <button type="button" className={`${BTN_DANGER} px-3.5 py-1.5 text-xs`} onClick={() => onOffboard(u.id)}>Offboard</button>
                </>
              )}
              {(u.status === 'active' || u.status === 'pending_verification') && (
                <button type="button" className={`${BTN_DANGER} px-3.5 py-1.5 text-xs`} onClick={() => onOffboard(u.id)}>Offboard</button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
