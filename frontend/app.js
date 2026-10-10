// Plain fetch calls against the backend auth endpoints.
const tabSignup = document.getElementById('tab-signup');
const tabSignin = document.getElementById('tab-signin');
const formSignup = document.getElementById('form-signup');
const formSignin = document.getElementById('form-signin');
const welcome = document.getElementById('welcome');
const welcomeTitle = document.getElementById('welcome-title');
const welcomeDetail = document.getElementById('welcome-detail');
const btnSignout = document.getElementById('btn-signout');
const message = document.getElementById('message');
const adminPanel = document.getElementById('admin');
const btnUsers = document.getElementById('btn-users');
const btnAudit = document.getElementById('btn-audit');
const usersBox = document.getElementById('users');
const auditBox = document.getElementById('audit');
const usersRoleFilter = document.getElementById('users-role-filter');
// Admin: clinics POST /api/v1/admin/clinics
const formClinic = document.getElementById('form-clinic');
// Admin: users POST /api/v1/admin/users
const formCreateUser = document.getElementById('form-create-user');
// Admin: doctors + receptionists + patients
const formDoctor = document.getElementById('form-doctor');
const formDoctorAssign = document.getElementById('form-doctor-assign');
const formRecep = document.getElementById('form-recep');
const formRecepAssign = document.getElementById('form-recep-assign');
const btnPatients = document.getElementById('btn-patients');
const patientsUnlinked = document.getElementById('patients-unlinked');
const patientsBox = document.getElementById('patients');
const formPatientLink = document.getElementById('form-patient-link');
// Admin: all-appointments queue GET /api/v1/appointments/
const adminApptStatus = document.getElementById('admin-appt-status');
const btnAdminQueue = document.getElementById('btn-admin-queue');
const adminQueueBox = document.getElementById('admin-queue');
// Staff extras
const staffStatus = document.getElementById('staff-status');
const btnStaffOptions = document.getElementById('btn-staff-options');
const staffOptionsBox = document.getElementById('staff-options');
// Owner extras
const ownerStatus = document.getElementById('owner-status');
const roleClinic = document.getElementById('role-clinic');
const roleName = document.getElementById('role-name');
const roleSpec = document.getElementById('role-spec');
const patientPanel = document.getElementById('patient');
const staffPanel = document.getElementById('staff');
const ownerPanel = document.getElementById('owner');
const ownerClinic = document.getElementById('owner-clinic');
const btnOwnerLoad = document.getElementById('btn-owner-load');
const ownerStaffBox = document.getElementById('owner-staff');
const formOwnerStaff = document.getElementById('form-owner-staff');
const ownerQueueBox = document.getElementById('owner-queue');
const reportFrom = document.getElementById('report-from');
const reportTo = document.getElementById('report-to');
const btnReportAppt = document.getElementById('btn-report-appt');
const btnReportBilling = document.getElementById('btn-report-billing');
const ownerReportsBox = document.getElementById('owner-reports');
const btnQueue = document.getElementById('btn-queue');
const queueBox = document.getElementById('queue');
const btnMine = document.getElementById('btn-mine');
const mineBox = document.getElementById('mine');
const formBook = document.getElementById('form-book');
const bookClinic = document.getElementById('book-clinic');
const bookDoctor = document.getElementById('book-doctor');
const bookDate = document.getElementById('book-date');
const bookReason = document.getElementById('book-reason');
let bookingDoctors = [];

const ROLES = ['admin', 'doctor', 'receptionist', 'patient', 'owner'];

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + sessionStorage.getItem('token'),
  };
}

function showMessage(text, kind) {
  message.textContent = text;
  message.className = 'message' + (kind ? ' ' + kind : '');
}

function showView(view) {
  const showSignup = view === 'signup';
  tabSignup.classList.toggle('active', showSignup);
  tabSignin.classList.toggle('active', !showSignup);
  formSignup.classList.toggle('hidden', !showSignup);
  formSignin.classList.toggle('hidden', showSignup);
  welcome.classList.add('hidden');
  adminPanel.classList.add('hidden');
  patientPanel.classList.add('hidden');
  staffPanel.classList.add('hidden');
  ownerPanel.classList.add('hidden');
  // Hide auth tabs once signed in; show them again on signout via showView.
  document.querySelector('.tabs').classList.toggle('hidden', view === 'app');
}

function currentRole() {
  return sessionStorage.getItem('role');
}

function requireRole(...roles) {
  if (!roles.includes(currentRole())) {
    showMessage(`This action requires role: ${roles.join(' or ')}. You are signed in as ${currentRole() || 'nobody'}.`, 'error');
    return false;
  }
  if (!sessionStorage.getItem('token')) {
    showMessage('Please sign in first.', 'error');
    return false;
  }
  return true;
}

async function readError(res, fallback) {
  try {
    const data = await res.json();
    if (data && data.error) return data.error;
  } catch (_) {
    // non-JSON response
  }
  return fallback;
}

tabSignup.addEventListener('click', () => {
  showMessage('', '');
  showView('signup');
});

tabSignin.addEventListener('click', () => {
  showMessage('', '');
  showView('signin');
});

formSignup.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const name = document.getElementById('signup-name').value.trim();

  if (!email || !password) {
    showMessage('Email and password are required.', 'error');
    return;
  }

  let res;
  try {
    res = await fetch('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...(name ? { name } : {}) }),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }

  if (res.status === 201) {
    showMessage('Account created. Please sign in.', 'success');
    formSignup.reset();
    showView('signin');
  } else if (res.status === 409) {
    showMessage('User already exists, please login', 'error');
    showView('signin');
  } else {
    showMessage(await readError(res, 'Sign up failed. Please try again.'), 'error');
  }
});

formSignin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;

  if (!email || !password) {
    showMessage('Email and password are required.', 'error');
    return;
  }

  let res;
  try {
    res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }

  if (res.ok) {
    const data = await res.json();
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('role', data.user.role);
    resetLists();
    welcomeTitle.textContent = 'Signed in';
    welcomeDetail.textContent = `${data.user.email} (${data.user.role})`;
    showView('app');
    welcome.classList.remove('hidden');
    // Role → visible panels + initial data loads. Mirrors backend guards:
    // admin: /admin/* + GET /appointments/ (+ approve/reject/cancel)
    // doctor/receptionist: GET /appointments/ (+ approve/reject/cancel)
    // patient: POST / + GET /mine + PATCH /:id/cancel
    // owner: /owner/* + PATCH /appointments/:id/cancel
    // any auth user: GET /booking-options
    if (data.user.role === 'admin') {
      adminPanel.classList.remove('hidden');
      loadRoleClinics();
      loadAdminQueue();
    }
    if (data.user.role === 'patient') {
      patientPanel.classList.remove('hidden');
      loadBookingOptions();
      loadMine();
    }
    if (data.user.role === 'doctor' || data.user.role === 'receptionist') {
      staffPanel.classList.remove('hidden');
      loadQueue();
    }
    if (data.user.role === 'owner') {
      ownerPanel.classList.remove('hidden');
      loadOwnerClinics();
    }
    showMessage('', '');
    formSignin.reset();
  } else if (res.status === 401) {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    showView('signin');
    resetLists();
    showMessage('Invalid email or password.', 'error');
  } else {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    showView('signin');
    resetLists();
    showMessage(await readError(res, 'Sign in failed. Please try again.'), 'error');
  }
});

btnSignout.addEventListener('click', () => {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('role');
  showView('signin');
  resetLists();
  showMessage('Signed out.', 'success');
});

// Clear every data list so a previous account's data is never shown
// after switching accounts or signing out.
function resetLists() {
  usersBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
  auditBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
  patientsBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
  adminQueueBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
  staffOptionsBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
  mineBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
  queueBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
  ownerStaffBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
  ownerQueueBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
  ownerReportsBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
}

// GET /api/v1/admin/users — list all users with a per-user role control.
// Admin only (backend: requireAdmin).
btnUsers.addEventListener('click', async () => {
  if (!requireRole('admin')) return;
  usersBox.innerHTML = '<p class="muted">Loading…</p>';
  const params = new URLSearchParams();
  if (usersRoleFilter.value) params.set('role', usersRoleFilter.value);
  const qs = params.toString();
  let res;
  try {
    res = await fetch(`/api/v1/admin/users${qs ? `?${qs}` : ''}`, { headers: authHeaders() });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    usersBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading users failed.'), 'error');
    usersBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  const data = await res.json();
  if (!data.users.length) {
    usersBox.innerHTML = '<p class="muted">No users found.</p>';
    return;
  }
  usersBox.innerHTML = '';
  data.users.forEach((u) => {
    const row = document.createElement('div');
    row.className = 'user-row';
    const options = ROLES.map((r) =>
      `<option value="${r}"${r === u.role ? ' selected' : ''}>${r}</option>`
    ).join('');
    row.innerHTML =
      `<span class="who">#${esc(u.id)} ${esc(u.email)}<br/>${esc(u.role)}${u.is_active ? '' : ' (inactive)'}</span>` +
      `<select data-id="${u.id}">${options}</select>` +
      `<button type="button" data-act="role" data-id="${u.id}">Set role</button>` +
      `<button type="button" data-act="del" data-id="${u.id}" class="reject">Delete</button>`;
    row.querySelector('[data-act="role"]').addEventListener('click', async () => {
      const role = row.querySelector('select').value;
      await updateRole(u.id, role);
    });
    row.querySelector('[data-act="del"]').addEventListener('click', async () => {
      await deleteUser(u.id);
    });
    usersBox.appendChild(row);
  });
});

// DELETE /api/v1/admin/users/:id — deactivate a user. Admin only.
async function deleteUser(id) {
  if (!requireRole('admin')) return;
  if (!window.confirm(`Deactivate user #${id}?`)) return;
  let res;
  try {
    res = await fetch(`/api/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.ok) {
    showMessage('User deactivated.', 'success');
    btnUsers.click();
  } else {
    showMessage(await readError(res, 'Delete user failed.'), 'error');
  }
}

// POST /api/v1/admin/clinics — create a clinic. Admin only.
formClinic.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!requireRole('admin')) return;
  const body = {
    name: document.getElementById('clinic-name').value.trim(),
    phone_number: document.getElementById('clinic-phone').value.trim(),
    address: document.getElementById('clinic-address').value.trim(),
    email: document.getElementById('clinic-email').value.trim(),
  };
  let res;
  try {
    res = await fetch('/api/v1/admin/clinics', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.status === 201) {
    const data = await res.json();
    showMessage(`Clinic created: ${data.clinic.name} (#${data.clinic.id}).`, 'success');
    formClinic.reset();
    loadRoleClinics();
  } else {
    showMessage(await readError(res, 'Creating clinic failed.'), 'error');
  }
});

// POST /api/v1/admin/users — create a user with any role. Admin only.
formCreateUser.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!requireRole('admin')) return;
  const role = document.getElementById('new-user-role').value;
  const body = {
    email: document.getElementById('new-user-email').value.trim(),
    password: document.getElementById('new-user-password').value,
    role,
  };
  const clinicVal = document.getElementById('new-user-clinic').value;
  const nameVal = document.getElementById('new-user-name').value.trim();
  const phoneVal = document.getElementById('new-user-phone').value.trim();
  const specVal = document.getElementById('new-user-spec').value.trim();
  if (clinicVal) body.clinic_id = Number(clinicVal);
  if (nameVal) body.name = nameVal;
  if (phoneVal) body.phone_number = phoneVal;
  if (specVal) body.specialization = specVal;
  let res;
  try {
    res = await fetch('/api/v1/admin/users', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.status === 201) {
    const data = await res.json();
    showMessage(`User created: ${data.user.email} (${data.user.role}).`, 'success');
    formCreateUser.reset();
    btnUsers.click();
  } else {
    showMessage(await readError(res, 'Creating user failed.'), 'error');
  }
});

// POST /api/v1/admin/doctors — link an existing doctor-role user to a clinic. Admin only.
formDoctor.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!requireRole('admin')) return;
  const body = {
    user_id: Number(document.getElementById('doctor-user-id').value),
    clinic_id: Number(document.getElementById('doctor-clinic-id').value),
    name: document.getElementById('doctor-name').value.trim(),
    specialization: document.getElementById('doctor-spec').value.trim(),
  };
  const phone = document.getElementById('doctor-phone').value.trim();
  if (phone) body.phone_number = phone;
  let res;
  try {
    res = await fetch('/api/v1/admin/doctors', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.status === 201) {
    showMessage('Doctor profile created.', 'success');
    formDoctor.reset();
  } else {
    showMessage(await readError(res, 'Creating doctor failed.'), 'error');
  }
});

// PUT /api/v1/admin/doctors/:id/assign — move a doctor to another clinic. Admin only.
formDoctorAssign.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!requireRole('admin')) return;
  const id = document.getElementById('doctor-assign-id').value;
  const clinic_id = Number(document.getElementById('doctor-assign-clinic').value);
  let res;
  try {
    res = await fetch(`/api/v1/admin/doctors/${id}/assign`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ clinic_id }),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.ok) {
    showMessage('Doctor assigned to clinic.', 'success');
    formDoctorAssign.reset();
  } else {
    showMessage(await readError(res, 'Assigning doctor failed.'), 'error');
  }
});

// POST /api/v1/admin/receptionists — Admin only.
formRecep.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!requireRole('admin')) return;
  const body = {
    user_id: Number(document.getElementById('recep-user-id').value),
    clinic_id: Number(document.getElementById('recep-clinic-id').value),
    name: document.getElementById('recep-name').value.trim(),
  };
  const phone = document.getElementById('recep-phone').value.trim();
  if (phone) body.phone_number = phone;
  let res;
  try {
    res = await fetch('/api/v1/admin/receptionists', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.status === 201) {
    showMessage('Receptionist profile created.', 'success');
    formRecep.reset();
  } else {
    showMessage(await readError(res, 'Creating receptionist failed.'), 'error');
  }
});

// PUT /api/v1/admin/receptionists/:id/assign — Admin only.
formRecepAssign.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!requireRole('admin')) return;
  const id = document.getElementById('recep-assign-id').value;
  const clinic_id = Number(document.getElementById('recep-assign-clinic').value);
  let res;
  try {
    res = await fetch(`/api/v1/admin/receptionists/${id}/assign`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ clinic_id }),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.ok) {
    showMessage('Receptionist assigned to clinic.', 'success');
    formRecepAssign.reset();
  } else {
    showMessage(await readError(res, 'Assigning receptionist failed.'), 'error');
  }
});

// GET /api/v1/admin/patients — Admin only.
btnPatients.addEventListener('click', async () => {
  if (!requireRole('admin')) return;
  patientsBox.innerHTML = '<p class="muted">Loading…</p>';
  const qs = patientsUnlinked.checked ? '?unlinked=true' : '';
  let res;
  try {
    res = await fetch(`/api/v1/admin/patients${qs}`, { headers: authHeaders() });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    patientsBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading patients failed.'), 'error');
    patientsBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  const data = await res.json();
  if (!data.patients.length) {
    patientsBox.innerHTML = '<p class="muted">No patients found.</p>';
    return;
  }
  patientsBox.innerHTML = data.patients
    .map((p) => `<div class="audit-row">#${esc(p.id)} ${esc(p.name || '—')} &lt;${esc(p.email || '—')}&gt; user:${esc(p.user_id ?? 'unlinked')}</div>`)
    .join('');
});

// PUT /api/v1/admin/patients/:id/link-user — Admin only.
formPatientLink.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!requireRole('admin')) return;
  const id = document.getElementById('patient-link-id').value;
  const user_id = Number(document.getElementById('patient-link-user').value);
  let res;
  try {
    res = await fetch(`/api/v1/admin/patients/${id}/link-user`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ user_id }),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.ok) {
    showMessage('Patient linked to user.', 'success');
    formPatientLink.reset();
    btnPatients.click();
  } else {
    showMessage(await readError(res, 'Linking patient failed.'), 'error');
  }
});

// GET /api/v1/appointments/booking-options — reuse the clinic list so the
// admin can pick a clinic when promoting to a staff role.
async function loadRoleClinics() {
  try {
    const res = await fetch('/api/v1/appointments/booking-options', { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    roleClinic.innerHTML = data.clinics
      .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
      .join('');
  } catch (_) {
    // stays empty; backend will say which field is missing
  }
}

// PATCH /api/v1/admin/users/:id/role — change one user's role. Admin only.
async function updateRole(id, role) {
  if (!requireRole('admin')) return;
  const body = { role };
  if (role === 'doctor' || role === 'receptionist' || role === 'owner') {
    if (roleClinic.value) body.clinic_id = Number(roleClinic.value);
  }
  if (role === 'doctor' || role === 'receptionist') {
    if (roleName.value.trim()) body.name = roleName.value.trim();
    if (roleSpec.value.trim()) body.specialization = roleSpec.value.trim();
  }
  let res;
  try {
    res = await fetch(`/api/v1/admin/users/${id}/role`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.ok) {
    const data = await res.json();
    showMessage(`Role updated: ${data.user.email} is now ${data.user.role}.`, 'success');
    btnUsers.click();
  } else {
    showMessage(await readError(res, 'Role update failed.'), 'error');
  }
}

// GET /api/v1/admin/audit-logs — show who changed what. Admin only.
btnAudit.addEventListener('click', async () => {
  if (!requireRole('admin')) return;
  auditBox.innerHTML = '<p class="muted">Loading…</p>';
  let res;
  try {
    res = await fetch('/api/v1/admin/audit-logs', { headers: authHeaders() });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    auditBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading audit log failed.'), 'error');
    auditBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  const data = await res.json();
  if (!data.audit_logs.length) {
    auditBox.innerHTML = '<p class="muted">No audit entries yet.</p>';
    return;
  }
  auditBox.innerHTML = data.audit_logs
    .map((l) => {
      const subject = l.target_email
        || (l.appointment_id ? 'appointment #' + l.appointment_id : '—');
      const change = `${esc(l.old_role || l.old_status || '—')} → ${esc(l.new_role || l.new_status || '—')}`;
      const scope = l.clinic_id ? ` @ clinic #${esc(l.clinic_id)}` : '';
      const by = l.performed_by === null ? 'system' : '#' + esc(l.performed_by);
      return `<div class="audit-row">${esc(l.action)}: ${esc(subject)} ${change}${scope} (by ${by})</div>`;
    })
    .join('');
});

// Shared renderer for appointment queues (staff + admin).
// Backend: doctor sees own, receptionist sees clinic, admin sees all.
function renderAppointmentList(box, appointments, emptyText, onDecide, onCancel) {
  if (!appointments.length) {
    box.innerHTML = `<p class="muted">${esc(emptyText)}</p>`;
    return;
  }
  box.innerHTML = '';
  appointments.forEach((a) => {
    const row = document.createElement('div');
    row.className = 'user-row';
    const when = new Date(a.appointment_date).toLocaleString();
    row.innerHTML =
      `<span class="who">#${esc(a.id)} ${esc(a.patient_name || '')} → ${esc(a.doctor_name || '')}<br/>` +
      `${esc(a.clinic_name || '')} · ${esc(when)} · ${esc(a.status)}` +
      `${a.reason ? ' · ' + esc(a.reason) : ''}</span>`;
    if (a.status === 'pending') {
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'approve';
      ok.textContent = 'Approve';
      ok.addEventListener('click', () => onDecide(a.id, 'approve'));
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'reject';
      no.textContent = 'Reject';
      no.addEventListener('click', () => onDecide(a.id, 'reject'));
      row.appendChild(ok);
      row.appendChild(no);
    }
    // PATCH /api/v1/appointments/:id/cancel — every authenticated role may
    // cancel within its scope (patient: own + 24h rule, staff/owner/admin: scope).
    if (a.status === 'pending' || a.status === 'scheduled') {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => onCancel(a.id));
      row.appendChild(cancel);
    }
    box.appendChild(row);
  });
}

// GET /api/v1/appointments/ — staff queue (backend scopes: doctor sees own,
// receptionist sees own clinic, admin sees all).
async function loadQueue() {
  if (!requireRole('doctor', 'receptionist')) return;
  queueBox.innerHTML = '<p class="muted">Loading…</p>';
  const qs = staffStatus.value ? `?status=${encodeURIComponent(staffStatus.value)}` : '';
  let res;
  try {
    res = await fetch(`/api/v1/appointments/${qs}`, { headers: authHeaders() });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    queueBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading queue failed.'), 'error');
    queueBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  const data = await res.json();
  renderAppointmentList(queueBox, data.appointments, 'No appointments in your scope.', decideAppointment, cancelAnyAppointment);
}

btnQueue.addEventListener('click', loadQueue);

// PATCH /api/v1/appointments/:id/approve|reject — doctor, receptionist, admin.
async function decideAppointment(id, decision) {
  if (!requireRole('doctor', 'receptionist')) return;
  let res;
  try {
    res = await fetch(`/api/v1/appointments/${id}/${decision}`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.ok) {
    const data = await res.json();
    showMessage(data.message || `Appointment ${decision}d.`, 'success');
    loadQueue();
  } else {
    showMessage(await readError(res, `${decision} failed.`), 'error');
  }
}

// PATCH /api/v1/appointments/:id/cancel — any signed-in role within its scope.
// Used by staff, admin and owner queues (patients use cancelAppointment below
// which refreshes the "mine" list instead).
async function cancelAnyAppointment(id) {
  if (!sessionStorage.getItem('token')) {
    showMessage('Please sign in first.', 'error');
    return;
  }
  let res;
  try {
    res = await fetch(`/api/v1/appointments/${id}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.ok) {
    showMessage('Appointment cancelled.', 'success');
    const role = currentRole();
    if (role === 'admin') loadAdminQueue();
    else if (role === 'owner') loadOwnerQueue();
    else loadQueue();
  } else {
    showMessage(await readError(res, 'Cancellation failed.'), 'error');
  }
}

// GET /api/v1/appointments/ — admin view (sees all). Admin only in the UI,
// backend additionally allows doctor/receptionist (covered by staff queue).
async function loadAdminQueue() {
  if (!requireRole('admin')) return;
  adminQueueBox.innerHTML = '<p class="muted">Loading…</p>';
  const qs = adminApptStatus.value ? `?status=${encodeURIComponent(adminApptStatus.value)}` : '';
  let res;
  try {
    res = await fetch(`/api/v1/appointments/${qs}`, { headers: authHeaders() });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    adminQueueBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading appointments failed.'), 'error');
    adminQueueBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  const data = await res.json();
  renderAppointmentList(adminQueueBox, data.appointments, 'No appointments yet.', decideAdminAppointment, cancelAnyAppointment);
}

btnAdminQueue.addEventListener('click', loadAdminQueue);

// PATCH /api/v1/appointments/:id/approve|reject — admin variant (refreshes admin list).
async function decideAdminAppointment(id, decision) {
  if (!requireRole('admin')) return;
  let res;
  try {
    res = await fetch(`/api/v1/appointments/${id}/${decision}`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.ok) {
    const data = await res.json();
    showMessage(data.message || `Appointment ${decision}d.`, 'success');
    loadAdminQueue();
  } else {
    showMessage(await readError(res, `${decision} failed.`), 'error');
  }
}

// GET /api/v1/appointments/booking-options — any authenticated user.
// Exposed here so staff can look up valid clinic/doctor IDs.
btnStaffOptions.addEventListener('click', async () => {
  if (!requireRole('doctor', 'receptionist')) return;
  staffOptionsBox.innerHTML = '<p class="muted">Loading…</p>';
  let res;
  try {
    res = await fetch('/api/v1/appointments/booking-options', { headers: authHeaders() });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    staffOptionsBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading options failed.'), 'error');
    staffOptionsBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  const data = await res.json();
  staffOptionsBox.innerHTML =
    `<div class="audit-row">Clinics: ${esc(data.clinics.map((c) => `#${c.id} ${c.name}`).join(', ') || '—')}</div>` +
    `<div class="audit-row">Doctors: ${esc(data.doctors.map((d) => `#${d.id} ${d.name} (clinic #${d.clinic_id})`).join(', ') || '—')}</div>`;
});

// ---- Owner panel ----

const ownerApi = (path, options = {}) =>
  fetch(`/api/v1/owner${path}`, {
    ...options,
    headers: authHeaders(),
  });

// GET /api/v1/owner/clinics — which clinics I own. Owner only.
async function loadOwnerClinics() {
  if (!requireRole('owner')) return;
  let res;
  try {
    res = await ownerApi('/clinics');
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading clinics failed.'), 'error');
    return;
  }
  const data = await res.json();
  ownerClinic.innerHTML = data.clinics
    .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
    .join('');
  if (!data.clinics.length) {
    showMessage('No clinics assigned to your account yet.', 'error');
    return;
  }
  loadOwnerAll();
}

function loadOwnerAll() {
  if (!ownerClinic.value) return;
  loadOwnerStaff();
  loadOwnerQueue();
}

btnOwnerLoad.addEventListener('click', loadOwnerAll);
ownerClinic.addEventListener('change', loadOwnerAll);

// GET /api/v1/owner/clinics/:id/staff — owner only.
async function loadOwnerStaff() {
  if (!requireRole('owner')) return;
  ownerStaffBox.innerHTML = '<p class="muted">Loading…</p>';
  let res;
  try {
    res = await ownerApi(`/clinics/${ownerClinic.value}/staff`);
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading staff failed.'), 'error');
    return;
  }
  const data = await res.json();
  if (!data.staff.length) {
    ownerStaffBox.innerHTML = '<p class="muted">No staff yet. Add the first below.</p>';
    return;
  }
  ownerStaffBox.innerHTML = '';
  data.staff.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'user-row';
    const extra = s.role === 'doctor' ? ` (${esc(s.specialization || '')})` : '';
    row.innerHTML =
      `<span class="who">${esc(s.email)}<br/>${esc(s.role)}${extra}${s.is_active ? '' : ' (inactive)'}</span>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'remove';
    btn.textContent = 'Remove';
    if (!s.is_active) btn.disabled = true;
    btn.addEventListener('click', () => removeOwnerStaff(s.user_id));
    row.appendChild(btn);
    ownerStaffBox.appendChild(row);
  });
}

// POST /api/v1/owner/clinics/:id/staff — owner only.
formOwnerStaff.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!requireRole('owner')) return;
  const email = document.getElementById('owner-staff-email').value.trim();
  const password = document.getElementById('owner-staff-password').value;
  const role = document.getElementById('owner-staff-role').value;
  const name = document.getElementById('owner-staff-name').value.trim();
  const specialization = document.getElementById('owner-staff-spec').value.trim();
  if (!email || !password || !name) {
    showMessage('Email, password, and name are required.', 'error');
    return;
  }
  let res;
  try {
    res = await ownerApi(`/clinics/${ownerClinic.value}/staff`, {
      method: 'POST',
      body: JSON.stringify({
        email, password, role, name,
        ...(specialization ? { specialization } : {}),
      }),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.status === 201) {
    showMessage('Staff account created.', 'success');
    formOwnerStaff.reset();
    loadOwnerStaff();
  } else {
    showMessage(await readError(res, 'Creating staff failed.'), 'error');
  }
});

// DELETE /api/v1/owner/clinics/:id/staff/:userId — owner only.
async function removeOwnerStaff(userId) {
  if (!requireRole('owner')) return;
  let res;
  try {
    res = await ownerApi(`/clinics/${ownerClinic.value}/staff/${userId}`, { method: 'DELETE' });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.ok) {
    showMessage('Staff account deactivated.', 'success');
    loadOwnerStaff();
  } else {
    showMessage(await readError(res, 'Removing staff failed.'), 'error');
  }
}

// GET /api/v1/owner/clinics/:id/appointments — owner only (plus status filter).
async function loadOwnerQueue() {
  if (!requireRole('owner')) return;
  ownerQueueBox.innerHTML = '<p class="muted">Loading…</p>';
  const params = new URLSearchParams();
  if (ownerStatus.value) params.set('status', ownerStatus.value);
  const qs = params.toString();
  let res;
  try {
    res = await ownerApi(`/clinics/${ownerClinic.value}/appointments${qs ? `?${qs}` : ''}`);
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading queue failed.'), 'error');
    return;
  }
  const data = await res.json();
  if (!data.appointments.length) {
    ownerQueueBox.innerHTML = '<p class="muted">No appointments at this clinic.</p>';
    return;
  }
  ownerQueueBox.innerHTML = '';
  data.appointments.forEach((a) => {
    const row = document.createElement('div');
    row.className = 'user-row';
    const when = new Date(a.appointment_date).toLocaleString();
    row.innerHTML =
      `<span class="who">#${esc(a.id)} ${esc(a.patient_name || '')} → ${esc(a.doctor_name || '')}<br/>` +
      `${esc(when)} · ${esc(a.status)}</span>`;
    if (a.status === 'pending') {
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'approve';
      ok.textContent = 'Approve';
      ok.addEventListener('click', () => decideOwnerAppointment(a.id, 'approve'));
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'reject';
      no.textContent = 'Reject';
      no.addEventListener('click', () => decideOwnerAppointment(a.id, 'reject'));
      row.appendChild(ok);
      row.appendChild(no);
    }
    // PATCH /api/v1/appointments/:id/cancel — owners may cancel in-scope
    // appointments via the generic endpoint (owner routes only approve/reject).
    if (a.status === 'pending' || a.status === 'scheduled') {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => cancelAnyAppointment(a.id));
      row.appendChild(cancel);
    }
    ownerQueueBox.appendChild(row);
  });
}

// PATCH /api/v1/owner/appointments/:id/approve|reject — owner only.
async function decideOwnerAppointment(id, decision) {
  if (!requireRole('owner')) return;
  let res;
  try {
    res = await ownerApi(`/appointments/${id}/${decision}`, { method: 'PATCH' });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.ok) {
    const data = await res.json();
    showMessage(data.message || `Appointment ${decision}d.`, 'success');
    loadOwnerQueue();
  } else {
    showMessage(await readError(res, `${decision} failed.`), 'error');
  }
}

function reportQuery() {
  const params = new URLSearchParams();
  if (reportFrom.value) params.set('from', reportFrom.value);
  if (reportTo.value) params.set('to', reportTo.value);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function reportTable(headers, rows) {
  return `<table class="report-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// GET /api/v1/owner/clinics/:id/reports/appointments — owner only.
btnReportAppt.addEventListener('click', async () => {
  if (!requireRole('owner')) return;
  ownerReportsBox.innerHTML = '<p class="muted">Loading…</p>';
  let res;
  try {
    res = await ownerApi(`/clinics/${ownerClinic.value}/reports/appointments${reportQuery()}`);
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading report failed.'), 'error');
    return;
  }
  const data = await res.json();
  const byStatus = reportTable(
    ['Status', 'Count'],
    data.by_status.map((r) => [r.status, r.count])
  );
  const perDoctor = reportTable(
    ['Doctor', 'Status', 'Count'],
    data.per_doctor.map((r) => [r.doctor_name, r.status, r.count])
  );
  ownerReportsBox.innerHTML = `<h4>By status</h4>${byStatus}<h4>Per doctor</h4>${perDoctor}`;
});

// GET /api/v1/owner/clinics/:id/reports/billing — owner only.
btnReportBilling.addEventListener('click', async () => {
  if (!requireRole('owner')) return;
  ownerReportsBox.innerHTML = '<p class="muted">Loading…</p>';
  let res;
  try {
    res = await ownerApi(`/clinics/${ownerClinic.value}/reports/billing${reportQuery()}`);
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading report failed.'), 'error');
    return;
  }
  const data = await res.json();
  const byStatus = reportTable(
    ['Payment status', 'Bills', 'Total'],
    data.by_payment_status.map((r) => [r.payment_status || '—', r.bills, r.total])
  );
  ownerReportsBox.innerHTML =
    `<h4>Overall: ${data.overall.bills} bills, total ${data.overall.total}</h4>${byStatus}`;
});

// GET /api/v1/appointments/booking-options — fill the clinic/doctor dropdowns.
async function loadBookingOptions() {
  let res;
  try {
    res = await fetch('/api/v1/appointments/booking-options', { headers: authHeaders() });
  } catch (_) {
    return;
  }
  if (!res.ok) return;
  const data = await res.json();
  bookClinic.innerHTML = data.clinics
    .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
    .join('');
  bookingDoctors = data.doctors;
  refreshDoctorOptions();
  if (!data.clinics.length || !data.doctors.length) {
    showMessage('No clinics or doctors available for booking yet.', 'error');
  }
}

function refreshDoctorOptions() {
  const clinicId = bookClinic.value;
  const matches = bookingDoctors.filter((d) => String(d.clinic_id) === String(clinicId));
  bookDoctor.innerHTML = matches
    .map((d) => `<option value="${d.id}">${esc(d.name)} (${esc(d.specialization || '')})</option>`)
    .join('');
}

bookClinic.addEventListener('change', refreshDoctorOptions);

// GET /api/v1/appointments/mine — list my appointments with cancel buttons. Patient only.
async function loadMine() {
  if (!requireRole('patient')) return;
  mineBox.innerHTML = '<p class="muted">Loading…</p>';
  let res;
  try {
    res = await fetch('/api/v1/appointments/mine', { headers: authHeaders() });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    mineBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  if (!res.ok) {
    showMessage(await readError(res, 'Loading appointments failed.'), 'error');
    mineBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
    return;
  }
  const data = await res.json();
  if (!data.appointments.length) {
    mineBox.innerHTML = '<p class="muted">No appointments yet. Book one below.</p>';
    return;
  }
  mineBox.innerHTML = '';
  data.appointments.forEach((a) => {
    const row = document.createElement('div');
    row.className = 'user-row';
    const when = new Date(a.appointment_date).toLocaleString();
    row.innerHTML =
      `<span class="who">${esc(a.doctor_name || '')} @ ${esc(a.clinic_name || '')}<br/>` +
      `${esc(when)} · ${esc(a.status)}</span>` +
      `<button type="button">Cancel</button>`;
    const btn = row.querySelector('button');
    if (a.status === 'cancelled') btn.disabled = true;
    btn.addEventListener('click', () => cancelAppointment(a.id));
    mineBox.appendChild(row);
  });
}

btnMine.addEventListener('click', loadMine);

// PATCH /api/v1/appointments/:id/cancel — cancel my own appointment. Patient only.
async function cancelAppointment(id) {
  if (!requireRole('patient')) return;
  let res;
  try {
    res = await fetch(`/api/v1/appointments/${id}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.ok) {
    showMessage('Appointment cancelled.', 'success');
    loadMine();
  } else {
    showMessage(await readError(res, 'Cancellation failed.'), 'error');
  }
}

// POST /api/v1/appointments/ — request a new appointment. Patient only.
formBook.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!requireRole('patient')) return;
  if (!bookClinic.value || !bookDoctor.value || !bookDate.value) {
    showMessage('Clinic, doctor, and date are required.', 'error');
    return;
  }
  let res;
  try {
    res = await fetch('/api/v1/appointments/', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        clinic_id: Number(bookClinic.value),
        doctor_id: Number(bookDoctor.value),
        appointment_date: new Date(bookDate.value).toISOString(),
        reason: bookReason.value.trim() || undefined,
      }),
    });
  } catch (_) {
    showMessage('Cannot reach the server. Is it running?', 'error');
    return;
  }
  if (res.status === 201) {
    showMessage('Appointment requested. It becomes active once the clinic approves it.', 'success');
    formBook.reset();
    loadMine();
  } else {
    showMessage(await readError(res, 'Booking failed.'), 'error');
  }
});
