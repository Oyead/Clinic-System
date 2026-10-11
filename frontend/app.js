const tabSignup = document.getElementById('tab-signup');
const tabSignin = document.getElementById('tab-signin');
const formSignup = document.getElementById('form-signup');
const formSignin = document.getElementById('form-signin');
const welcome = document.getElementById('welcome');
const welcomeTitle = document.getElementById('welcome-title');
const welcomeDetail = document.getElementById('welcome-detail');
const btnSignout = document.getElementById('btn-signout');
const message = document.getElementById('message');
const roleBanner = document.getElementById('role-banner');
const roleBannerTitle = document.getElementById('role-banner-title');
const roleBannerSub = document.getElementById('role-banner-sub');
const adminPanel = document.getElementById('admin');
const btnUsers = document.getElementById('btn-users');
const btnAudit = document.getElementById('btn-audit');
const usersBox = document.getElementById('users');
const auditBox = document.getElementById('audit');
const usersRoleFilter = document.getElementById('users-role-filter');

const formClinic = document.getElementById('form-clinic');

const formCreateUser = document.getElementById('form-create-user');

const formDoctor = document.getElementById('form-doctor');
const formDoctorAssign = document.getElementById('form-doctor-assign');
const formRecep = document.getElementById('form-recep');
const formRecepAssign = document.getElementById('form-recep-assign');
const btnPatients = document.getElementById('btn-patients');
const patientsUnlinked = document.getElementById('patients-unlinked');
const patientsBox = document.getElementById('patients');
const formPatientLink = document.getElementById('form-patient-link');

const adminApptStatus = document.getElementById('admin-appt-status');
const btnAdminQueue = document.getElementById('btn-admin-queue');
const adminQueueBox = document.getElementById('admin-queue');

const staffStatus = document.getElementById('staff-status');
const btnStaffOptions = document.getElementById('btn-staff-options');
const staffOptionsBox = document.getElementById('staff-options');

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

const ROLE_META = {
  admin: { theme: 'admin', title: 'Admin console', sub: 'Clinics, people and appointments' },
  doctor: { theme: 'staff', title: 'Care team', sub: 'Review and decide appointment requests' },
  receptionist: { theme: 'staff', title: 'Care team', sub: 'Review and decide appointment requests' },
  owner: { theme: 'owner', title: 'Practice owner', sub: 'Staff, appointments and reports for your clinics' },
  patient: { theme: 'patient', title: 'My care', sub: 'Your appointments and booking' },
};

function applyRoleTheme(role) {
  const meta = ROLE_META[role];
  if (!meta) return;
  document.body.dataset.role = meta.theme;
  roleBannerTitle.textContent = meta.title;
  roleBannerSub.textContent = meta.sub;
  roleBanner.classList.remove('hidden');
}

function clearRoleTheme() {
  delete document.body.dataset.role;
  roleBanner.classList.add('hidden');
}

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
  const isApp = view === 'app';
  const showSignup = view === 'signup';
  tabSignup.classList.toggle('active', showSignup);
  tabSignin.classList.toggle('active', !showSignup);

  formSignup.classList.toggle('hidden', isApp || !showSignup);
  formSignin.classList.toggle('hidden', isApp || showSignup);
  welcome.classList.add('hidden');
  adminPanel.classList.add('hidden');
  patientPanel.classList.add('hidden');
  staffPanel.classList.add('hidden');
  ownerPanel.classList.add('hidden');

  document.querySelector('.tabs').classList.toggle('hidden', view === 'app');
  if (view !== 'app') clearRoleTheme();
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
    applyRoleTheme(data.user.role);
    welcomeTitle.textContent = 'Signed in';
    welcomeDetail.textContent = `${data.user.email} (${data.user.role})`;
    showView('app');
    welcome.classList.remove('hidden');

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

async function loadRoleClinics() {
  try {
    const res = await fetch('/api/v1/appointments/booking-options', { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    roleClinic.innerHTML = data.clinics
      .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
      .join('');
  } catch (_) {

  }
}

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

const ownerApi = (path, options = {}) =>
  fetch(`/api/v1/owner${path}`, {
    ...options,
    headers: authHeaders(),
  });

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
