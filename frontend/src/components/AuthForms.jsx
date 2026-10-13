import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { PasswordInput } from './SecretField.jsx';
import { ROUTES } from '../router.js';

const emptyClinic = { email: '', password: '', clinicName: '', phone: '', address: '' };

const bind = (form, setForm, setErr, key) => ({
  value: form[key],
  onChange: (e) => { setErr(''); setForm((f) => ({ ...f, [key]: e.target.value })); },
});

function ExistsHint({ error }) {
  return (
    <>
      {error || 'User already exists, please sign in.'}{' '}
      <a className="form-link" href={`#${ROUTES.SIGNIN}`}>Go to Sign in</a>
    </>
  );
}

export function PatientSignupForm({ onSignedIn }) {
  const { signup } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [exists, setExists] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = form.email.trim();
    const password = form.password;
    const name = form.name.trim();
    if (!email || !password) {
      setExists(false);
      setError('Email and password are required.');
      return;
    }
    setError('');
    setExists(false);
    try {
      const result = await signup({ email, password, name });
      if (result.ok) {
        setForm({ email: '', password: '', name: '' });
        onSignedIn?.(result.user);
      } else if (result.exists) {
        setExists(true);
        setError(result.error || 'User already exists, please sign in.');
      } else {
        setError(result.error || 'Sign up failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.');
    }
  };

  return (
    <form className="card" noValidate onSubmit={handleSubmit}>
      <label>
        Email
        <input type="email" required autoComplete="email" {...bind(form, setForm, setError, 'email')} />
      </label>
      <label>
        Password (min 8 characters)
            <PasswordInput required minLength={8} autoComplete="new-password" {...bind(form, setForm, setError, 'password')} />
          </label>
          <label>
            Full name (optional, needed for booking appointments)
        <input type="text" autoComplete="name" {...bind(form, setForm, setError, 'name')} />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {exists ? <ExistsHint error={error} /> : error}
        </p>
      )}
      <button type="submit">Create account</button>
    </form>
  );
}

export function ClinicSignupForm({ onSignedIn }) {
  const { signupClinic } = useAuth();
  const [form, setForm] = useState(emptyClinic);
  const [error, setError] = useState('');
  const [exists, setExists] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = form.email.trim();
    const password = form.password;
    const clinic = {
      name: form.clinicName.trim(),
      phone_number: form.phone.trim(),
      address: form.address.trim(),
    };
    if (!email || !password || !clinic.name || !clinic.phone_number || !clinic.address) {
      setExists(false);
      setError('Owner email, password, and all clinic fields are required.');
      return;
    }
    setError('');
    setExists(false);
    try {
      const result = await signupClinic({ email, password, clinic });
      if (result.ok) {
        setForm(emptyClinic);
        onSignedIn?.(result.user);
      } else if (result.exists) {
        setExists(true);
        setError(result.error || 'User already exists, please sign in.');
      } else {
        setError(result.error || 'Clinic sign up failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Clinic sign up failed. Please try again.');
    }
  };

  return (
    <form className="card" noValidate onSubmit={handleSubmit}>
      <label>
        Owner email
        <input type="email" required autoComplete="email" {...bind(form, setForm, setError, 'email')} />
      </label>
      <label>
        Password (min 8 characters)
            <PasswordInput required minLength={8} autoComplete="new-password" {...bind(form, setForm, setError, 'password')} />
          </label>
          <label>
            Clinic name
        <input type="text" required {...bind(form, setForm, setError, 'clinicName')} />
      </label>
      <label>
        Clinic phone
        <input type="text" required {...bind(form, setForm, setError, 'phone')} />
      </label>
      <label>
        Clinic address
        <input type="text" required {...bind(form, setForm, setError, 'address')} />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {exists ? <ExistsHint error={error} /> : error}
        </p>
      )}
      <p className="hint">Submits your clinic for platform verification. You can sign in right away; staff invites unlock after approval.</p>
      <button type="submit">Register clinic</button>
    </form>
  );
}

export function AcceptInviteForm({ onSignedIn, initialToken = '' }) {
  const { acceptInvite } = useAuth();
  const [form, setForm] = useState({ token: initialToken, password: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = form.token.trim();
    const password = form.password;
    if (!token || !password) {
      setError('Invite token and a new password are required.');
      return;
    }
    setError('');
    setDone('');
    try {
      const result = await acceptInvite({ token, password });
      if (result.ok) {
        setForm({ token: '', password: '' });
        setDone('Invite accepted — you are signed in.');
        onSignedIn?.(result.user);
      } else {
        setError(result.error || 'Accepting the invite failed.');
      }
    } catch (err) {
      setError(err.message || 'Accepting the invite failed.');
    }
  };

  return (
    <form className="card" noValidate onSubmit={handleSubmit}>
      <label>
        Invite token
        <input type="text" required placeholder="Paste the token your clinic owner shared" {...bind(form, setForm, setError, 'token')} />
      </label>
      <label>
        Choose a password (min 8 characters)
            <PasswordInput required minLength={8} autoComplete="new-password" {...bind(form, setForm, setError, 'password')} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {done && <p className="form-ok" role="status">{done}</p>}
      <button type="submit">Accept invite</button>
    </form>
  );
}

export function SigninForm({ onSignedIn, initialError = '' }) {
  const { signin } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(initialError);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = form.email.trim();
    const password = form.password;
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setError('');
    try {
      const result = await signin(email, password);
      if (result.ok) {
        setForm({ email: '', password: '' });
        onSignedIn?.(result.user);
      } else {
        setError(result.error || 'Invalid email or password.');
      }
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.');
    }
  };

  return (
    <form className="card" noValidate onSubmit={handleSubmit}>
      <label>
        Email
        <input type="email" required autoComplete="email" {...bind(form, setForm, setError, 'email')} />
      </label>
      <label>
        Password
            <PasswordInput required autoComplete="current-password" {...bind(form, setForm, setError, 'password')} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit">Sign in</button>
    </form>
  );
}
