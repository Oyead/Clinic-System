import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export function AuthForms({ onSignedIn }) {
  const { signup, signin, showMessage } = useAuth();
  const [tab, setTab] = useState('signup');
  const [signupForm, setSignupForm] = useState({ email: '', password: '', name: '' });
  const [signinForm, setSigninForm] = useState({ email: '', password: '' });

  const handleSignup = async (e) => {
    e.preventDefault();
    const email = signupForm.email.trim();
    const password = signupForm.password;
    const name = signupForm.name.trim();
    if (!email || !password) {
      showMessage('Email and password are required.', 'error');
      return;
    }
    try {
      const result = await signup({ email, password, name });
      if (result.ok) {
        setSignupForm({ email: '', password: '', name: '' });
        setTab('signin');
      } else if (result.exists) {
        setTab('signin');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleSignin = async (e) => {
    e.preventDefault();
    const email = signinForm.email.trim();
    const password = signinForm.password;
    if (!email || !password) {
      showMessage('Email and password are required.', 'error');
      return;
    }
    try {
      const result = await signin(email, password);
      if (result.ok) {
        setSigninForm({ email: '', password: '' });
        onSignedIn?.(result.user);
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  return (
    <>
      <div className="tabs">
        <button
          type="button"
          className={`tab${tab === 'signup' ? ' active' : ''}`}
          onClick={() => { showMessage('', ''); setTab('signup'); }}
        >
          Sign up
        </button>
        <button
          type="button"
          className={`tab${tab === 'signin' ? ' active' : ''}`}
          onClick={() => { showMessage('', ''); setTab('signin'); }}
        >
          Sign in
        </button>
      </div>

      {tab === 'signup' ? (
        <form className="card" noValidate onSubmit={handleSignup}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={signupForm.email}
              onChange={(e) => setSignupForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label>
            Password (min 8 characters)
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={signupForm.password}
              onChange={(e) => setSignupForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <label>
            Full name (optional, needed for booking appointments)
            <input
              type="text"
              autoComplete="name"
              value={signupForm.name}
              onChange={(e) => setSignupForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <button type="submit">Create account</button>
        </form>
      ) : (
        <form className="card" noValidate onSubmit={handleSignin}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={signinForm.email}
              onChange={(e) => setSigninForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={signinForm.password}
              onChange={(e) => setSigninForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <button type="submit">Sign in</button>
        </form>
      )}
    </>
  );
}
