import { useCallback, useEffect, useState } from 'react';

export const ROUTES = {
  HOME: '/',
  SIGNUP: '/signup',
  SIGNUP_CLINIC: '/signup-clinic',
  ACCEPT_INVITE: '/accept-invite',
  SIGNIN: '/signin',
  PRIVACY: '/privacy',
  TERMS: '/terms',
};

export const AUTH_ROUTES = [ROUTES.SIGNUP, ROUTES.SIGNUP_CLINIC, ROUTES.ACCEPT_INVITE, ROUTES.SIGNIN];

export function parseHash() {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '') || '/';
  const qIndex = raw.indexOf('?');
  const path = (qIndex === -1 ? raw : raw.slice(0, qIndex)) || '/';
  const params = new URLSearchParams(qIndex === -1 ? '' : raw.slice(qIndex + 1));
  return { path, params };
}

export function navigate(path) {
  window.location.hash = `#${path}`;
}

export function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const go = useCallback((path) => navigate(path), []);
  return { ...route, navigate: go };
}
