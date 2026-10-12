export async function readError(res, fallback) {
  try {
    const data = await res.json();
    if (data && data.error) return data.error;
  } catch (_) {
  }
  return fallback;
}

export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function request(path, { token, ...options } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(path, { ...options, headers: { ...headers, ...options.headers } });
  } catch (_) {
    throw new Error('Cannot reach the server. Is it running?');
  }
  return res;
}

export const api = {
  signup: ({ email, password, name }) =>
    request('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(name ? { name } : {}) }),
    }),

  login: ({ email, password }) =>
    request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  adminUsers: (token, role) =>
    request(`/api/v1/admin/users${role ? `?role=${encodeURIComponent(role)}` : ''}`, { token }),

  adminCreateUser: (token, body) =>
    request('/api/v1/admin/users', { token, method: 'POST', body: JSON.stringify(body) }),

  adminUpdateRole: (token, id, body) =>
    request(`/api/v1/admin/users/${id}/role`, { token, method: 'PATCH', body: JSON.stringify(body) }),

  adminDeleteUser: (token, id) =>
    request(`/api/v1/admin/users/${id}`, { token, method: 'DELETE' }),

  adminCreateClinic: (token, body) =>
    request('/api/v1/admin/clinics', { token, method: 'POST', body: JSON.stringify(body) }),

  adminCreateDoctor: (token, body) =>
    request('/api/v1/admin/doctors', { token, method: 'POST', body: JSON.stringify(body) }),

  adminAssignDoctor: (token, id, clinic_id) =>
    request(`/api/v1/admin/doctors/${id}/assign`, {
      token,
      method: 'PUT',
      body: JSON.stringify({ clinic_id }),
    }),

  adminCreateReceptionist: (token, body) =>
    request('/api/v1/admin/receptionists', { token, method: 'POST', body: JSON.stringify(body) }),

  adminAssignReceptionist: (token, id, clinic_id) =>
    request(`/api/v1/admin/receptionists/${id}/assign`, {
      token,
      method: 'PUT',
      body: JSON.stringify({ clinic_id }),
    }),

  adminPatients: (token, unlinkedOnly) =>
    request(`/api/v1/admin/patients${unlinkedOnly ? '?unlinked=true' : ''}`, { token }),

  adminLinkPatient: (token, id, user_id) =>
    request(`/api/v1/admin/patients/${id}/link-user`, {
      token,
      method: 'PUT',
      body: JSON.stringify({ user_id }),
    }),

  adminAuditLogs: (token) => request('/api/v1/admin/audit-logs', { token }),

  appointments: (token, status) =>
    request(`/api/v1/appointments/${status ? `?status=${encodeURIComponent(status)}` : ''}`, { token }),

  decideAppointment: (token, id, decision) =>
    request(`/api/v1/appointments/${id}/${decision}`, { token, method: 'PATCH' }),

  cancelAppointment: (token, id) =>
    request(`/api/v1/appointments/${id}/cancel`, { token, method: 'PATCH' }),

  bookingOptions: (token) => request('/api/v1/appointments/booking-options', { token }),

  myAppointments: (token) => request('/api/v1/appointments/mine', { token }),

  bookAppointment: (token, body) =>
    request('/api/v1/appointments/', { token, method: 'POST', body: JSON.stringify(body) }),

  owner: (token, path, options = {}) =>
    request(`/api/v1/owner${path}`, { token, ...options }),
};
