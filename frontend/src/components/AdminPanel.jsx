import { useCallback, useEffect, useState } from 'react';
import { api, readError } from '../api/client.js';
import { useAuth, ROLES } from '../context/AuthContext.jsx';
import { AppointmentList, StatusFilter } from './Appointments.jsx';

const initialFilters = {
  role: '',
  roleExtras: { clinic: '', name: '', spec: '' },
  unlinkedOnly: false,
  queueStatus: '',
};

const initialData = {
  users: null,
  usersLoading: false,
  audit: null,
  patients: null,
  queue: null,
  roleClinics: [],
};

const initialForms = {
  clinic: { name: '', phone_number: '', address: '', email: '' },
  user: { email: '', password: '', role: 'patient', clinic_id: '', name: '', phone_number: '', specialization: '' },
  doctor: { user_id: '', clinic_id: '', name: '', phone_number: '', specialization: '' },
  doctorAssign: { id: '', clinic_id: '' },
  recep: { user_id: '', clinic_id: '', name: '', phone_number: '' },
  recepAssign: { id: '', clinic_id: '' },
  link: { patient_id: '', user_id: '' },
};

export function AdminPanel() {
  const { token, showMessage } = useAuth();
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(initialData);
  const [forms, setForms] = useState(initialForms);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleRoleExtraChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, roleExtras: { ...prev.roleExtras, [name]: value } }));
  };

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

  const { role: roleFilter, roleExtras, unlinkedOnly, queueStatus } = filters;
  const { users, usersLoading, audit, patients, queue, roleClinics } = data;
  const { clinic: clinicForm, user: userForm, doctor: doctorForm, doctorAssign, recep: recepForm, recepAssign, link: linkForm } = forms;

  const loadRoleClinics = useCallback(async () => {
    try {
      const res = await api.bookingOptions(token);
      if (!res.ok) return;
      const payload = await res.json();
      updateData('roleClinics', payload.clinics ?? []);
    } catch (_) {
    }
  }, [token, updateData]);

  const loadUsers = useCallback(async () => {
    updateData('usersLoading', true);
    try {
      const res = await api.adminUsers(token, roleFilter);
      if (!res.ok) {
        showMessage(await readError(res, 'Loading users failed.'), 'error');
        updateData('users', null);
        return;
      }
      const payload = await res.json();
      updateData('users', payload.users);
    } catch (err) {
      showMessage(err.message, 'error');
      updateData('users', null);
    } finally {
      updateData('usersLoading', false);
    }
  }, [token, roleFilter, showMessage, updateData]);

  const loadQueue = useCallback(async () => {
    try {
      const res = await api.appointments(token, queueStatus);
      if (!res.ok) {
        showMessage(await readError(res, 'Loading appointments failed.'), 'error');
        updateData('queue', null);
        return;
      }
      const payload = await res.json();
      updateData('queue', payload.appointments);
    } catch (err) {
      showMessage(err.message, 'error');
      updateData('queue', null);
    }
  }, [token, queueStatus, showMessage, updateData]);

  useEffect(() => {
    loadRoleClinics();
    loadQueue();
  }, [loadRoleClinics, loadQueue]);

  const updateRole = async (id, role) => {
    const body = { role };
    if (role === 'doctor' || role === 'receptionist' || role === 'owner') {
      if (roleExtras.clinic) body.clinic_id = Number(roleExtras.clinic);
    }
    if (role === 'doctor' || role === 'receptionist') {
      if (roleExtras.name.trim()) body.name = roleExtras.name.trim();
      if (roleExtras.spec.trim()) body.specialization = roleExtras.spec.trim();
    }
    try {
      const res = await api.adminUpdateRole(token, id, body);
      if (res.ok) {
        const payload = await res.json();
        showMessage(`Role updated: ${payload.user.email} is now ${payload.user.role}.`, 'success');
        loadUsers();
      } else {
        showMessage(await readError(res, 'Role update failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm(`Deactivate user #${id}?`)) return;
    try {
      const res = await api.adminDeleteUser(token, id);
      if (res.ok) {
        showMessage('User deactivated.', 'success');
        loadUsers();
      } else {
        showMessage(await readError(res, 'Delete user failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const decide = async (id, decision) => {
    try {
      const res = await api.decideAppointment(token, id, decision);
      if (res.ok) {
        const payload = await res.json();
        showMessage(payload.message || `Appointment ${decision}d.`, 'success');
        loadQueue();
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
        loadQueue();
      } else {
        showMessage(await readError(res, 'Cancellation failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const submitClinic = async (e) => {
    e.preventDefault();
    try {
      const res = await api.adminCreateClinic(token, clinicForm);
      if (res.status === 201) {
        const payload = await res.json();
        showMessage(`Clinic created: ${payload.clinic.name} (#${payload.clinic.id}).`, 'success');
        resetForm('clinic');
        loadRoleClinics();
      } else {
        showMessage(await readError(res, 'Creating clinic failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const submitUser = async (e) => {
    e.preventDefault();
    const body = { email: userForm.email.trim(), password: userForm.password, role: userForm.role };
    if (userForm.clinic_id) body.clinic_id = Number(userForm.clinic_id);
    if (userForm.name.trim()) body.name = userForm.name.trim();
    if (userForm.phone_number.trim()) body.phone_number = userForm.phone_number.trim();
    if (userForm.specialization.trim()) body.specialization = userForm.specialization.trim();
    try {
      const res = await api.adminCreateUser(token, body);
      if (res.status === 201) {
        const payload = await res.json();
        showMessage(`User created: ${payload.user.email} (${payload.user.role}).`, 'success');
        resetForm('user');
        loadUsers();
      } else {
        showMessage(await readError(res, 'Creating user failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const submitDoctor = async (e) => {
    e.preventDefault();
    const body = {
      user_id: Number(doctorForm.user_id),
      clinic_id: Number(doctorForm.clinic_id),
      name: doctorForm.name.trim(),
      specialization: doctorForm.specialization.trim(),
    };
    if (doctorForm.phone_number.trim()) body.phone_number = doctorForm.phone_number.trim();
    try {
      const res = await api.adminCreateDoctor(token, body);
      if (res.status === 201) {
        showMessage('Doctor profile created.', 'success');
        resetForm('doctor');
      } else {
        showMessage(await readError(res, 'Creating doctor failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const submitDoctorAssign = async (e) => {
    e.preventDefault();
    try {
      const res = await api.adminAssignDoctor(token, doctorAssign.id, Number(doctorAssign.clinic_id));
      if (res.ok) {
        showMessage('Doctor assigned to clinic.', 'success');
        resetForm('doctorAssign');
      } else {
        showMessage(await readError(res, 'Assigning doctor failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const submitRecep = async (e) => {
    e.preventDefault();
    const body = {
      user_id: Number(recepForm.user_id),
      clinic_id: Number(recepForm.clinic_id),
      name: recepForm.name.trim(),
    };
    if (recepForm.phone_number.trim()) body.phone_number = recepForm.phone_number.trim();
    try {
      const res = await api.adminCreateReceptionist(token, body);
      if (res.status === 201) {
        showMessage('Receptionist profile created.', 'success');
        resetForm('recep');
      } else {
        showMessage(await readError(res, 'Creating receptionist failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const submitRecepAssign = async (e) => {
    e.preventDefault();
    try {
      const res = await api.adminAssignReceptionist(token, recepAssign.id, Number(recepAssign.clinic_id));
      if (res.ok) {
        showMessage('Receptionist assigned to clinic.', 'success');
        resetForm('recepAssign');
      } else {
        showMessage(await readError(res, 'Assigning receptionist failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const loadPatients = async () => {
    try {
      const res = await api.adminPatients(token, unlinkedOnly);
      if (!res.ok) {
        showMessage(await readError(res, 'Loading patients failed.'), 'error');
        updateData('patients', null);
        return;
      }
      const payload = await res.json();
      updateData('patients', payload.patients);
    } catch (err) {
      showMessage(err.message, 'error');
      updateData('patients', null);
    }
  };

  const submitLink = async (e) => {
    e.preventDefault();
    try {
      const res = await api.adminLinkPatient(token, linkForm.patient_id, Number(linkForm.user_id));
      if (res.ok) {
        showMessage('Patient linked to user.', 'success');
        resetForm('link');
        loadPatients();
      } else {
        showMessage(await readError(res, 'Linking patient failed.'), 'error');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const loadAudit = async () => {
    try {
      const res = await api.adminAuditLogs(token);
      if (!res.ok) {
        showMessage(await readError(res, 'Loading audit log failed.'), 'error');
        updateData('audit', null);
        return;
      }
      const payload = await res.json();
      updateData('audit', payload.audit_logs);
    } catch (err) {
      showMessage(err.message, 'error');
      updateData('audit', null);
    }
  };

  return (
    <section className="card">
      <h2><span className="eyebrow">Administration</span>Console</h2>

      <h3>Clinics <span className="hint">POST /api/v1/admin/clinics</span></h3>
      <form className="profile-fields" noValidate onSubmit={submitClinic}>
        <label>Name<input name="name" required placeholder="e.g. Downtown Clinic" value={clinicForm.name} onChange={(e) => handleFormChange('clinic', e)} /></label>
        <label>Phone number<input name="phone_number" required placeholder="e.g. +1-555-0100" value={clinicForm.phone_number} onChange={(e) => handleFormChange('clinic', e)} /></label>
        <label>Address<input name="address" required placeholder="e.g. 123 Main St" value={clinicForm.address} onChange={(e) => handleFormChange('clinic', e)} /></label>
        <label>Email<input name="email" type="email" required placeholder="e.g. clinic@example.com" value={clinicForm.email} onChange={(e) => handleFormChange('clinic', e)} /></label>
        <button type="submit">Create clinic</button>
      </form>
      <div><p className="muted">Clinics appear in the dropdowns after creation.</p></div>

      <h3>Create user <span className="hint">POST /api/v1/admin/users</span></h3>
      <form className="profile-fields" noValidate onSubmit={submitUser}>
        <label>Email<input name="email" type="email" required value={userForm.email} onChange={(e) => handleFormChange('user', e)} /></label>
        <label>Password (min 8 characters)<input name="password" type="password" required minLength={8} value={userForm.password} onChange={(e) => handleFormChange('user', e)} /></label>
        <label>Role
          <select name="role" value={userForm.role} onChange={(e) => handleFormChange('user', e)}>
            <option value="patient">patient</option>
            <option value="doctor">doctor</option>
            <option value="receptionist">receptionist</option>
            <option value="owner">owner</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label>Clinic ID (doctor / receptionist / owner)<input name="clinic_id" type="number" min={1} placeholder="e.g. 1" value={userForm.clinic_id} onChange={(e) => handleFormChange('user', e)} /></label>
        <label>Full name (patient / doctor / receptionist)<input name="name" type="text" placeholder="e.g. Jane Doe" value={userForm.name} onChange={(e) => handleFormChange('user', e)} /></label>
        <label>Phone (optional)<input name="phone_number" type="text" value={userForm.phone_number} onChange={(e) => handleFormChange('user', e)} /></label>
        <label>Specialization (doctors only)<input name="specialization" type="text" placeholder="e.g. cardiology" value={userForm.specialization} onChange={(e) => handleFormChange('user', e)} /></label>
        <button type="submit">Create user</button>
      </form>

      <h3>Users <span className="hint">GET /api/v1/admin/users · PATCH /api/v1/admin/users/:id/role · DELETE /api/v1/admin/users/:id</span></h3>
      <div className="row">
        <button type="button" onClick={loadUsers}>Load users</button>
        <button type="button" onClick={loadAudit}>Load audit log</button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label style={{ flex: 1 }}>Role filter
          <select value={roleFilter} onChange={(e) => updateFilter('role', e.target.value)}>
            <option value="">all roles</option>
            <option value="admin">admin</option>
            <option value="doctor">doctor</option>
            <option value="receptionist">receptionist</option>
            <option value="patient">patient</option>
            <option value="owner">owner</option>
          </select>
        </label>
      </div>
      <div className="profile-fields">
        <p className="hint">Only needed when setting a role to doctor/receptionist (creates their staff profile):</p>
        <label>Clinic
          <select name="clinic" value={roleExtras.clinic} onChange={handleRoleExtraChange}>
            <option value="">—</option>
            {roleClinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Staff name<input name="name" type="text" placeholder="e.g. Jane Doe" value={roleExtras.name} onChange={handleRoleExtraChange} /></label>
        <label>Specialization (doctors only)<input name="spec" type="text" placeholder="e.g. cardiology" value={roleExtras.spec} onChange={handleRoleExtraChange} /></label>
      </div>
      <div>
        {usersLoading ? <p className="muted">Loading…</p>
          : users === null ? <p className="muted">Not loaded yet.</p>
          : users.length === 0 ? <p className="muted">No users found.</p>
          : <UserRows users={users} onUpdateRole={updateRole} onDelete={deleteUser} />}
      </div>

      <h3>Doctors <span className="hint">POST /api/v1/admin/doctors · PUT /api/v1/admin/doctors/:id/assign</span></h3>
      <form className="profile-fields" noValidate onSubmit={submitDoctor}>
        <label>User ID (must have role doctor)<input name="user_id" type="number" min={1} required value={doctorForm.user_id} onChange={(e) => handleFormChange('doctor', e)} /></label>
        <label>Clinic ID<input name="clinic_id" type="number" min={1} required value={doctorForm.clinic_id} onChange={(e) => handleFormChange('doctor', e)} /></label>
        <label>Name<input name="name" type="text" required value={doctorForm.name} onChange={(e) => handleFormChange('doctor', e)} /></label>
        <label>Phone (optional)<input name="phone_number" type="text" value={doctorForm.phone_number} onChange={(e) => handleFormChange('doctor', e)} /></label>
        <label>Specialization<input name="specialization" type="text" required value={doctorForm.specialization} onChange={(e) => handleFormChange('doctor', e)} /></label>
        <button type="submit">Create doctor profile</button>
      </form>
      <form className="profile-fields" noValidate onSubmit={submitDoctorAssign}>
        <label>Doctor ID<input name="id" type="number" min={1} required value={doctorAssign.id} onChange={(e) => handleFormChange('doctorAssign', e)} /></label>
        <label>New clinic ID<input name="clinic_id" type="number" min={1} required value={doctorAssign.clinic_id} onChange={(e) => handleFormChange('doctorAssign', e)} /></label>
        <button type="submit">Assign doctor to clinic</button>
      </form>

      <h3>Receptionists <span className="hint">POST /api/v1/admin/receptionists · PUT /api/v1/admin/receptionists/:id/assign</span></h3>
      <form className="profile-fields" noValidate onSubmit={submitRecep}>
        <label>User ID (must have role receptionist)<input name="user_id" type="number" min={1} required value={recepForm.user_id} onChange={(e) => handleFormChange('recep', e)} /></label>
        <label>Clinic ID<input name="clinic_id" type="number" min={1} required value={recepForm.clinic_id} onChange={(e) => handleFormChange('recep', e)} /></label>
        <label>Name<input name="name" type="text" required value={recepForm.name} onChange={(e) => handleFormChange('recep', e)} /></label>
        <label>Phone (optional)<input name="phone_number" type="text" value={recepForm.phone_number} onChange={(e) => handleFormChange('recep', e)} /></label>
        <button type="submit">Create receptionist profile</button>
      </form>
      <form className="profile-fields" noValidate onSubmit={submitRecepAssign}>
        <label>Receptionist ID<input name="id" type="number" min={1} required value={recepAssign.id} onChange={(e) => handleFormChange('recepAssign', e)} /></label>
        <label>New clinic ID<input name="clinic_id" type="number" min={1} required value={recepAssign.clinic_id} onChange={(e) => handleFormChange('recepAssign', e)} /></label>
        <button type="submit">Assign receptionist to clinic</button>
      </form>

      <h3>Patients <span className="hint">GET /api/v1/admin/patients · PUT /api/v1/admin/patients/:id/link-user</span></h3>
      <div className="row"><button type="button" onClick={loadPatients}>Load patients</button></div>
      <div className="row" style={{ marginTop: 8 }}>
        <label style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={unlinkedOnly} onChange={(e) => updateFilter('unlinkedOnly', e.target.checked)} /> Only unlinked
        </label>
      </div>
      <div>
        {patients === null ? <p className="muted">Not loaded yet.</p>
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
        {audit === null ? <p className="muted">Not loaded yet.</p>
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
        <button type="button" style={{ alignSelf: 'flex-end' }} onClick={loadQueue}>Load appointments</button>
      </div>
      <p className="hint">approve: PATCH /api/v1/appointments/:id/approve · reject: PATCH /api/v1/appointments/:id/reject · cancel: PATCH /api/v1/appointments/:id/cancel</p>
      <div>{queue === null ? <p className="muted">Not loaded yet.</p> : <AppointmentList appointments={queue} emptyText="No appointments yet." onDecide={decide} onCancel={cancel} />}</div>
    </section>
  );
}

function UserRows({ users, onUpdateRole, onDelete }) {
  const [selected, setSelected] = useState({});
  return (
    <>
      {users.map((u) => (
        <div className="user-row" key={u.id}>
          <span className="who">#{u.id} {u.email}<br />{u.role}{u.is_active ? '' : ' (inactive)'}</span>
          <select value={selected[u.id] ?? u.role} onChange={(e) => setSelected((s) => ({ ...s, [u.id]: e.target.value }))}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="button" onClick={() => onUpdateRole(u.id, selected[u.id] ?? u.role)}>Set role</button>
          <button type="button" className="reject" onClick={() => onDelete(u.id)}>Delete</button>
        </div>
      ))}
    </>
  );
}
