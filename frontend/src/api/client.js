export async function readError(res, fallback) {
  try {
    const data = await res.json();
    if (data && data.error) return data.error;
  } catch (_) {
  }
  const detail = res && res.status ? ` (HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''})` : '';
  return `${fallback}${detail}`;
}

export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export function buildRangeQuery(status, range) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (range && range.from) params.set('from', range.from);
  if (range && range.to) params.set('to', range.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

let refreshPromise = null;

async function performRefresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('refresh failed');
      const data = await res.json();
      return data.token;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request(path, { token, ...options } = {}, retried = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(path, {
      ...options,
      headers: { ...headers, ...options.headers },
      credentials: 'include',
    });
  } catch (_) {
    throw new Error('Cannot reach the server. Is it running?');
  }

  if (res.status === 401 && !retried) {
    try {
      const newToken = await performRefresh();
      return request(path, { token: newToken, ...options }, true);
    } catch (_) {
      throw new Error('Session expired. Please sign in again.');
    }
  }
  return res;
}

export const api = {
  signup: ({ email, password, name, phone_number }) =>
    request('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        ...(name ? { name } : {}),
        ...(phone_number ? { phone_number } : {}),
      }),
    }),

  updatePhone: (token, phone_number) =>
    request('/api/v1/auth/profile', {
      token,
      method: 'PATCH',
      body: JSON.stringify({ phone_number }),
    }),

  signupClinic: ({ email, password, clinic }) =>
    request('/api/v1/auth/signup-clinic', {
      method: 'POST',
      body: JSON.stringify({ email, password, clinic }),
    }),

  acceptInvite: ({ token, password }) =>
    request('/api/v1/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  login: ({ email, password }) =>
    request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refresh: () =>
    request('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' }),

  signout: () =>
    request('/api/v1/auth/signout', { method: 'POST', credentials: 'include' }),

  adminUsers: (token, role, status) => {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    const qs = params.toString();
    return request(`/api/v1/admin/users${qs ? `?${qs}` : ''}`, { token });
  },

  adminCreateAdmin: (token, body) =>
    request('/api/v1/admin/admins', { token, method: 'POST', body: JSON.stringify(body) }),

  adminSuspendUser: (token, id) =>
    request(`/api/v1/admin/users/${id}/suspend`, { token, method: 'POST' }),

  adminReinstateUser: (token, id, password) =>
    request(`/api/v1/admin/users/${id}/reinstate`, {
      token,
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  adminOffboardUser: (token, id) =>
    request(`/api/v1/admin/users/${id}/offboard`, { token, method: 'POST' }),

  adminDeleteUser: (token, id) =>
    request(`/api/v1/admin/users/${id}`, { token, method: 'DELETE' }),

  adminCreateClinic: (token, body) =>
    request('/api/v1/admin/clinics', { token, method: 'POST', body: JSON.stringify(body) }),

  adminClinics: (token, status) =>
    request(`/api/v1/admin/clinics${status ? `?status=${encodeURIComponent(status)}` : ''}`, { token }),

  adminApproveClinic: (token, id) =>
    request(`/api/v1/admin/clinics/${id}/approve`, { token, method: 'PATCH' }),

  adminInviteStaff: (token, body) =>
    request('/api/v1/admin/staff/invite', { token, method: 'POST', body: JSON.stringify(body) }),

  adminPatients: (token, unlinkedOnly) =>
    request(`/api/v1/admin/patients${unlinkedOnly ? '?unlinked=true' : ''}`, { token }),

  adminLinkPatient: (token, id, user_id) =>
    request(`/api/v1/admin/patients/${id}/link-user`, {
      token,
      method: 'PUT',
      body: JSON.stringify({ user_id }),
    }),

  adminAuditLogs: (token) => request('/api/v1/admin/audit-logs', { token }),

  appointments: (token, status, range) =>
    request(`/api/v1/appointments/${buildRangeQuery(status, range)}`, { token }),

  decideAppointment: (token, id, decision) =>
    request(`/api/v1/appointments/${id}/${decision}`, { token, method: 'PATCH' }),

  cancelAppointment: (token, id) =>
    request(`/api/v1/appointments/${id}/cancel`, { token, method: 'PATCH' }),

  bookingOptions: (token) => request('/api/v1/appointments/booking-options', { token }),

  myAppointments: (token, range) => request(`/api/v1/appointments/mine${buildRangeQuery('', range)}`, { token }),

  availability: (token, params = {}) => {
    const qs = new URLSearchParams();
    for (const k of ['doctor_id', 'clinic_id', 'status', 'from', 'to']) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') qs.set(k, params[k]);
    }
    const str = qs.toString();
    return request(`/api/v1/availability${str ? `?${str}` : ''}`, { token });
  },

  createAvailability: (token, body) =>
    request('/api/v1/availability', { token, method: 'POST', body: JSON.stringify(body) }),

  deleteAvailability: (token, id) =>
    request(`/api/v1/availability/${id}`, { token, method: 'DELETE' }),

  bookAppointment: (token, body) =>
    request('/api/v1/appointments/', { token, method: 'POST', body: JSON.stringify(body) }),

  owner: (token, path, options = {}) =>
    request(`/api/v1/owner${path}`, { token, ...options }),

  ownerAppointments: (token, clinicId, status, range) =>
    request(`/api/v1/owner/clinics/${clinicId}/appointments${buildRangeQuery(status, range)}`, { token }),

  ownerSetDoctorFee: (token, clinicId, doctorId, consultation_fee) =>
    request(`/api/v1/owner/clinics/${clinicId}/doctors/${doctorId}/fee`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ consultation_fee }),
    }),

  paymentConfig: (token) => request('/api/v1/payments/config', { token }),

  appointmentPayment: (token, id) =>
    request(`/api/v1/payments/appointments/${id}`, { token }),

  createPaymentIntention: (token, id, body = {}) =>
    request(`/api/v1/payments/appointments/${id}/intention`, {
      token,
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
