import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { PasswordInput } from './SecretField.jsx';
import { ROUTES } from '../router.js';
import { FORM_INPUT, BTN_PRIMARY } from './ui.js';

const emptyClinic = { email: '', password: '', clinicName: '', phone: '', address: '' };

const LABEL = 'flex flex-col gap-2 text-[0.8rem] font-bold tracking-[0.01em] text-[var(--color-ink)]';
const ERROR = 'rounded-[16px] bg-[rgba(248,161,136,0.18)] px-4 py-3 text-[0.82rem] font-medium text-[#a8442d]';

const bind = (form, setForm, setErr, key) => ({
  value: form[key],
  onChange: (e) => { setErr(''); setForm((f) => ({ ...f, [key]: e.target.value })); },
});

function ExistsHint({ error }) {
  return (
    <>
      {error || 'User already exists, please sign in.'}{' '}
      <a href={`#${ROUTES.SIGNIN}`} className="font-bold underline decoration-2 underline-offset-2">
        Go to Sign in
      </a>
    </>
  );
}

export function PatientSignupForm({ onSignedIn }) {
  const { signup } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', name: '', phone_number: '' });
  const [error, setError] = useState('');
  const [exists, setExists] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = form.email.trim();
    const password = form.password;
    const name = form.name.trim();
    const phone_number = form.phone_number.trim();
    if (!email || !password) {
      setExists(false);
      setError('Email and password are required.');
      return;
    }
    setError('');
    setExists(false);
    try {
      const result = await signup({ email, password, name, phone_number });
      if (result.ok) {
        setForm({ email: '', password: '', name: '', phone_number: '' });
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
    <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
      <label className={LABEL}>
        Email
        <input type="email" required autoComplete="email" className={FORM_INPUT} {...bind(form, setForm, setError, 'email')} />
      </label>
      <label className={LABEL}>
        Password (min 8 characters)
        <PasswordInput required minLength={8} autoComplete="new-password" {...bind(form, setForm, setError, 'password')} />
      </label>
      <label className={LABEL}>
        Full name <span className="font-medium text-[var(--color-ink-soft)]">optional, needed for booking appointments</span>
        <input type="text" autoComplete="name" className={FORM_INPUT} {...bind(form, setForm, setError, 'name')} />
      </label>
      <label className={LABEL}>
        Phone <span className="font-medium text-[var(--color-ink-soft)]">needed for online payment</span>
        <input type="tel" autoComplete="tel" className={FORM_INPUT} placeholder="+20 100 000 0000" {...bind(form, setForm, setError, 'phone_number')} />
      </label>
      {error && (
        <p className={ERROR} role="alert">
          {exists ? <ExistsHint error={error} /> : error}
        </p>
      )}
      <button type="submit" className={`${BTN_PRIMARY} mt-1 px-8 py-3.5 text-sm`}>Create account</button>
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
    <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
      <label className={LABEL}>
        Owner email
        <input type="email" required autoComplete="email" className={FORM_INPUT} {...bind(form, setForm, setError, 'email')} />
      </label>
      <label className={LABEL}>
        Password (min 8 characters)
        <PasswordInput required minLength={8} autoComplete="new-password" {...bind(form, setForm, setError, 'password')} />
      </label>
      <label className={LABEL}>
        Clinic name
        <input type="text" required className={FORM_INPUT} {...bind(form, setForm, setError, 'clinicName')} />
      </label>
      <label className={LABEL}>
        Clinic phone
        <input type="text" required className={FORM_INPUT} {...bind(form, setForm, setError, 'phone')} />
      </label>
      <label className={LABEL}>
        Clinic address
        <input type="text" required className={FORM_INPUT} {...bind(form, setForm, setError, 'address')} />
      </label>
      {error && (
        <p className={ERROR} role="alert">
          {exists ? <ExistsHint error={error} /> : error}
        </p>
      )}
      <p className="rounded-[16px] bg-[var(--color-sand)] px-4 py-3 text-[0.76rem] leading-[1.6] text-[var(--color-ink-soft)]">
        Submits your clinic for platform verification. You can sign in right away; staff invites unlock after approval.
      </p>
      <button type="submit" className={`${BTN_PRIMARY} mt-1 px-8 py-3.5 text-sm`}>Register clinic</button>
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
        setDone('Invite accepted - you are signed in.');
        onSignedIn?.(result.user);
      } else {
        setError(result.error || 'Accepting the invite failed.');
      }
    } catch (err) {
      setError(err.message || 'Accepting the invite failed.');
    }
  };

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
      <label className={LABEL}>
        Invite token
        <input type="text" required placeholder="Paste the token your clinic owner shared" className={FORM_INPUT} {...bind(form, setForm, setError, 'token')} />
      </label>
      <label className={LABEL}>
        Choose a password (min 8 characters)
        <PasswordInput required minLength={8} autoComplete="new-password" {...bind(form, setForm, setError, 'password')} />
      </label>
      {error && <p className={ERROR} role="alert">{error}</p>}
      {done && <p className="rounded-[16px] bg-[rgba(127,217,168,0.2)] px-4 py-3 text-[0.82rem] font-medium text-[#2f7d58]" role="status">{done}</p>}
      <button type="submit" className={`${BTN_PRIMARY} mt-1 px-8 py-3.5 text-sm`}>Accept invite</button>
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
    <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
      <label className={LABEL}>
        Email
        <input type="email" required autoComplete="email" className={FORM_INPUT} {...bind(form, setForm, setError, 'email')} />
      </label>
      <label className={LABEL}>
        Password
        <PasswordInput required autoComplete="current-password" {...bind(form, setForm, setError, 'password')} />
      </label>
      {error && <p className={ERROR} role="alert">{error}</p>}
      <button type="submit" className={`${BTN_PRIMARY} mt-1 px-8 py-3.5 text-sm`}>Sign in</button>
    </form>
  );
}
