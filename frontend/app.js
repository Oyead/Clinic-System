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
const roleClinic = document.getElementById('role-clinic');
const roleName = document.getElementById('role-name');
const roleSpec = document.getElementById('role-spec');
const patientPanel = document.getElementById('patient');
const staffPanel = document.getElementById('staff');
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

const ROLES = ['admin', 'doctor', 'receptionist', 'patient'];

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
    formSignup.classList.add('hidden');
    formSignin.classList.add('hidden');
    welcome.classList.remove('hidden');
    if (data.user.role === 'admin') {
      adminPanel.classList.remove('hidden');
      loadRoleClinics();
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
  mineBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
  queueBox.innerHTML = '<p class="muted">Not loaded yet.</p>';
}

// GET /api/v1/admin/users — list all users with a per-user role control.
btnUsers.addEventListener('click', async () => {
  usersBox.innerHTML = '<p class="muted">Loading…</p>';
  let res;
  try {
    res = await fetch('/api/v1/admin/users', { headers: authHeaders() });
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
      `<span class="who">${esc(u.email)}<br/>${esc(u.role)}${u.is_active ? '' : ' (inactive)'}</span>` +
      `<select data-id="${u.id}">${options}</select>` +
      `<button type="button" data-id="${u.id}">Set role</button>`;
    row.querySelector('button').addEventListener('click', async () => {
      const role = row.querySelector('select').value;
      await updateRole(u.id, role);
    });
    usersBox.appendChild(row);
  });
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

// PATCH /api/v1/admin/users/:id/role — change one user's role.
async function updateRole(id, role) {
  const body = { role };
  if (role === 'doctor' || role === 'receptionist') {
    if (roleClinic.value) body.clinic_id = Number(roleClinic.value);
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

// GET /api/v1/admin/audit-logs — show who changed what.
btnAudit.addEventListener('click', async () => {
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
      const by = l.performed_by === null ? 'system' : 'admin #' + esc(l.performed_by);
      return `<div class="audit-row">${esc(l.action)}: ${esc(subject)} ${change} (by ${by})</div>`;
    })
    .join('');
});

// GET /api/v1/appointments/ — staff queue (backend scopes: doctor sees own,
// receptionist sees own clinic, admin sees all).
async function loadQueue() {
  queueBox.innerHTML = '<p class="muted">Loading…</p>';
  let res;
  try {
    res = await fetch('/api/v1/appointments/', { headers: authHeaders() });
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
  if (!data.appointments.length) {
    queueBox.innerHTML = '<p class="muted">No appointments in your scope.</p>';
    return;
  }
  queueBox.innerHTML = '';
  data.appointments.forEach((a) => {
    const row = document.createElement('div');
    row.className = 'user-row';
    const when = new Date(a.appointment_date).toLocaleString();
    row.innerHTML =
      `<span class="who">${esc(a.patient_name || '')} → ${esc(a.doctor_name || '')}<br/>` +
      `${esc(a.clinic_name || '')} · ${esc(when)} · ${esc(a.status)}` +
      `${a.reason ? ' · ' + esc(a.reason) : ''}</span>`;
    if (a.status === 'pending') {
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'approve';
      ok.textContent = 'Approve';
      ok.addEventListener('click', () => decideAppointment(a.id, 'approve'));
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'reject';
      no.textContent = 'Reject';
      no.addEventListener('click', () => decideAppointment(a.id, 'reject'));
      row.appendChild(ok);
      row.appendChild(no);
    }
    queueBox.appendChild(row);
  });
}

btnQueue.addEventListener('click', loadQueue);

// PATCH /api/v1/appointments/:id/approve|reject
async function decideAppointment(id, decision) {
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

// GET /api/v1/appointments/mine — list my appointments with cancel buttons.
async function loadMine() {
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

// PATCH /api/v1/appointments/:id/cancel — cancel my own appointment.
async function cancelAppointment(id) {
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

// POST /api/v1/appointments/ — request a new appointment.
formBook.addEventListener('submit', async (e) => {
  e.preventDefault();
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
