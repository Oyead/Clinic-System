import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, readError } from '../api/client.js';

export const ROLES = ['admin', 'doctor', 'receptionist', 'patient', 'clinic_owner'];

// Legacy label spoken by old sessions/tokens.
export const normalizeRole = (role) => (role === 'owner' ? 'clinic_owner' : role);

export const ROLE_META = {
  admin: { theme: 'admin', title: 'Admin console', sub: 'Clinics, people and appointments' },
  doctor: { theme: 'staff', title: 'Care team', sub: 'Review and decide appointment requests' },
  receptionist: { theme: 'staff', title: 'Care team', sub: 'Review and decide appointment requests' },
  clinic_owner: { theme: 'owner', title: 'Clinic owner', sub: 'Staff, appointments and reports for your clinics' },
  patient: { theme: 'patient', title: 'My care', sub: 'Your appointments and booking' },
};

const AuthContext = createContext(null);

function loadSession() {
  try {
    return {
      token: sessionStorage.getItem('token'),
      role: normalizeRole(sessionStorage.getItem('role')),
      email: sessionStorage.getItem('email'),
      status: sessionStorage.getItem('status'),
      clinic_id: sessionStorage.getItem('clinic_id'),
    };
  } catch (_) {
    return { token: null, role: null, email: null, status: null, clinic_id: null };
  }
}

function saveSession(data) {
  sessionStorage.setItem('token', data.token);
  sessionStorage.setItem('role', data.user.role);
  sessionStorage.setItem('email', data.user.email);
  if (data.user.status) sessionStorage.setItem('status', data.user.status);
  else sessionStorage.removeItem('status');
  if (data.user.clinic_id) sessionStorage.setItem('clinic_id', String(data.user.clinic_id));
  else sessionStorage.removeItem('clinic_id');
  return {
    token: data.token,
    role: normalizeRole(data.user.role),
    email: data.user.email,
    status: data.user.status || null,
    clinic_id: data.user.clinic_id || null,
  };
}

function clearSession() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('role');
  sessionStorage.removeItem('email');
  sessionStorage.removeItem('status');
  sessionStorage.removeItem('clinic_id');
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);

  const signin = useCallback(
    async (email, password) => {
      const res = await api.login({ email, password });
      if (res.ok) {
        const data = await res.json();
        setSession(saveSession(data));
        return { ok: true, user: data.user, pending: data.pending_verification || data.user.status === 'pending_verification' };
      }
      clearSession();
      setSession({ token: null, role: null, email: null, status: null, clinic_id: null });
      if (res.status === 401) {
        return { ok: false, invalid: true, error: 'Invalid email or password.' };
      }
      return { ok: false, error: await readError(res, 'Sign in failed. Please try again.') };
    },
    [],
  );

  const signup = useCallback(
    async ({ email, password, name }) => {
      const res = await api.signup({ email, password, name });
      if (res.status === 201) {
        const data = await res.json().catch(() => null);
        if (data && data.token && data.user) {
          setSession(saveSession(data));
          return { ok: true, created: true, user: data.user };
        }
        // Fallback for older backends that don't return a token: sign in immediately
        // so a successful sign up lands on the dashboard without a second manual sign in.
        return await signin(email, password);
      }
      if (res.status === 409) {
        return { ok: false, exists: true, error: 'User already exists, please login' };
      }
      return { ok: false, error: await readError(res, 'Sign up failed. Please try again.') };
    },
    [signin],
  );

  const signupClinic = useCallback(async ({ email, password, clinic }) => {
    const res = await api.signupClinic({ email, password, clinic });
    if (res.status === 201) {
      const data = await res.json().catch(() => null);
      if (data && data.token && data.user) {
        setSession(saveSession(data));
        return { ok: true, created: true, user: data.user, clinic: data.clinic, pending: true };
      }
      return { ok: true, created: true };
    }
    if (res.status === 409) {
      return { ok: false, exists: true, error: 'User already exists, please login' };
    }
    return { ok: false, error: await readError(res, 'Clinic sign up failed. Please try again.') };
  }, []);

  const acceptInvite = useCallback(async ({ token, password }) => {
    const res = await api.acceptInvite({ token, password });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.token && data.user) {
        setSession(saveSession(data));
        return { ok: true, user: data.user };
      }
      return { ok: true };
    }
    return { ok: false, error: await readError(res, 'Accepting the invite failed.') };
  }, []);

  const signout = useCallback(() => {
    clearSession();
    setSession({ token: null, role: null, email: null, status: null, clinic_id: null });
  }, []);

  const value = useMemo(
    () => ({
      ...session,
      user: session.email ? { email: session.email, role: session.role, status: session.status, clinic_id: session.clinic_id } : null,
      pendingVerification: session.status === 'pending_verification',
      signin,
      signup,
      signupClinic,
      acceptInvite,
      signout,
    }),
    [session, signin, signup, signupClinic, acceptInvite, signout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
