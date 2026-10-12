import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, readError } from '../api/client.js';

export const ROLES = ['admin', 'doctor', 'receptionist', 'patient', 'owner'];

export const ROLE_META = {
  admin: { theme: 'admin', title: 'Admin console', sub: 'Clinics, people and appointments' },
  doctor: { theme: 'staff', title: 'Care team', sub: 'Review and decide appointment requests' },
  receptionist: { theme: 'staff', title: 'Care team', sub: 'Review and decide appointment requests' },
  owner: { theme: 'owner', title: 'Practice owner', sub: 'Staff, appointments and reports for your clinics' },
  patient: { theme: 'patient', title: 'My care', sub: 'Your appointments and booking' },
};

const AuthContext = createContext(null);

function loadSession() {
  try {
    return {
      token: sessionStorage.getItem('token'),
      role: sessionStorage.getItem('role'),
      email: sessionStorage.getItem('email'),
    };
  } catch (_) {
    return { token: null, role: null, email: null };
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);
  const [message, setMessage] = useState({ text: '', kind: '' });

  const showMessage = useCallback((text, kind = '') => {
    setMessage({ text, kind });
  }, []);

  const signin = useCallback(
    async (email, password) => {
      const res = await api.login({ email, password });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('role', data.user.role);
        sessionStorage.setItem('email', data.user.email);
        setSession({ token: data.token, role: data.user.role, email: data.user.email });
        showMessage('', '');
        return { ok: true, user: data.user };
      }
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('role');
      sessionStorage.removeItem('email');
      setSession({ token: null, role: null, email: null });
      if (res.status === 401) {
        showMessage('Invalid email or password.', 'error');
        return { ok: false };
      }
      showMessage(await readError(res, 'Sign in failed. Please try again.'), 'error');
      return { ok: false };
    },
    [showMessage],
  );

  const signup = useCallback(
    async ({ email, password, name }) => {
      const res = await api.signup({ email, password, name });
      if (res.status === 201) {
        showMessage('Account created. Please sign in.', 'success');
        return { ok: true, created: true };
      }
      if (res.status === 409) {
        showMessage('User already exists, please login', 'error');
        return { ok: false, exists: true };
      }
      showMessage(await readError(res, 'Sign up failed. Please try again.'), 'error');
      return { ok: false };
    },
    [showMessage],
  );

  const signout = useCallback(() => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('email');
    setSession({ token: null, role: null, email: null });
    showMessage('Signed out.', 'success');
  }, [showMessage]);

  const value = useMemo(
    () => ({ ...session, user: session.email ? { email: session.email, role: session.role } : null, message, showMessage, signin, signup, signout }),
    [session, message, showMessage, signin, signup, signout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
