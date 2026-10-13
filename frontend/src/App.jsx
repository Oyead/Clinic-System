import { useEffect, useState } from 'react';
import { AuthProvider, ROLE_META, useAuth } from './context/AuthContext.jsx';
import { PatientSignupForm, ClinicSignupForm, AcceptInviteForm, SigninForm } from './components/AuthForms.jsx';
import { AdminPanel } from './components/AdminPanel.jsx';
import { StaffPanel } from './components/StaffPanel.jsx';
import { OwnerPanel } from './components/OwnerPanel.jsx';
import { PatientPanel } from './components/PatientPanel.jsx';
import { Hero } from './components/Hero.jsx';
import { LogoEmblem } from './components/LogoEmblem.jsx';
import { IconArrowUp } from './components/icons.jsx';
import { ROUTES, AUTH_ROUTES, useHashRoute } from './router.js';

const NAV_LINKS = [
  { path: ROUTES.SIGNUP, label: 'Patient sign up' },
  { path: ROUTES.SIGNUP_CLINIC, label: 'Clinic sign up' },
  { path: ROUTES.ACCEPT_INVITE, label: 'Accept invite' },
  { path: ROUTES.SIGNIN, label: 'Sign in' },
];

function Shell() {
  const { token, role, email, status, pendingVerification, signout } = useAuth();
  const { path, params, navigate } = useHashRoute();

  const signedIn = Boolean(token);

  useEffect(() => {
    const meta = role ? ROLE_META[role] : null;
    if (token && meta) {
      document.body.dataset.role = meta.theme;
    } else {
      delete document.body.dataset.role;
    }
  }, [token, role]);

  useEffect(() => {
    const known = [ROUTES.HOME, ...AUTH_ROUTES, ROUTES.PRIVACY, ROUTES.TERMS];
    if (!known.includes(path)) {
      navigate(ROUTES.HOME);
    } else if (signedIn && AUTH_ROUTES.includes(path)) {
      navigate(ROUTES.HOME);
    }
  }, [path, signedIn, navigate]);

  const meta = role ? ROLE_META[role] : null;

  const handleSignout = () => {
    signout();
    navigate(ROUTES.HOME);
  };

  const afterAuth = () => navigate(ROUTES.HOME);

  return (
    <div className="app-frame" id="top">
      <header className="topbar glass">
        <a className="brand brand-link" href={`#${ROUTES.HOME}`} aria-label="Clinic System home">
          <LogoEmblem size={56} />
          <div>
            <span className="brand-name">Clinic System</span>
            <span className="brand-tag">Care, levelled up</span>
          </div>
        </a>
        <div className="topbar-spacer" />
        {signedIn ? (
          <div className="session-chip">
            <span>{email} · {role}</span>
            <button type="button" onClick={handleSignout}>
              Sign out
            </button>
          </div>
        ) : (
          <nav className="topnav" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a key={l.path} href={`#${l.path}`} className={path === l.path ? 'active' : ''}>
                {l.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {signedIn ? (
        <main className="dashboard">
          {meta && (
            <div className="role-banner" role="status">
              <span>{meta.title}</span>
              <small>{meta.sub} — signed in as {email} ({role}{status ? ` · ${status}` : ''})</small>
            </div>
          )}
          {pendingVerification && (
            <div className="container">
              <p className="message" role="status">
                Your clinic is pending platform verification. You can sign in, but staff invites unlock after approval.
              </p>
            </div>
          )}
          <div className="container">
            {role === 'admin' && <AdminPanel />}
            {(role === 'doctor' || role === 'receptionist') && <StaffPanel />}
            {(role === 'clinic_owner' || role === 'owner') && <OwnerPanel />}
            {role === 'patient' && <PatientPanel />}
          </div>
        </main>
      ) : path === ROUTES.SIGNUP ? (
        <AuthPage
          eyebrow="Patients"
          title="Patient sign up"
          sub="Create your account to book visits, earn platform credits and keep your Reliable Patient badge."
          form={<PatientSignupForm onSignedIn={afterAuth} />}
          switchTo={{ href: `#${ROUTES.SIGNIN}`, text: 'Already have an account? Sign in' }}
        />
      ) : path === ROUTES.SIGNUP_CLINIC ? (
        <AuthPage
          eyebrow="Clinics"
          title="Clinic sign up"
          sub="Register your practice. An admin verifies it before staff invites unlock."
          form={<ClinicSignupForm onSignedIn={afterAuth} />}
          switchTo={{ href: `#${ROUTES.SIGNIN}`, text: 'Already have an account? Sign in' }}
        />
      ) : path === ROUTES.ACCEPT_INVITE ? (
        <AuthPage
          eyebrow="Care team"
          title="Accept invite"
          sub="Paste the invite token your clinic owner shared, choose a password, and you're in."
          form={<AcceptInviteForm onSignedIn={afterAuth} initialToken={params.get('token') || ''} />}
          switchTo={{ href: `#${ROUTES.SIGNIN}`, text: 'Already have an account? Sign in' }}
        />
      ) : path === ROUTES.SIGNIN ? (
        <AuthPage
          eyebrow="Welcome back"
          title="Sign in"
          form={<SigninForm onSignedIn={afterAuth} />}
          switchTo={{ href: `#${ROUTES.SIGNUP}`, text: "New here? Create a patient account" }}
        />
      ) : path === ROUTES.PRIVACY ? (
        <LegalPage doc="privacy" />
      ) : path === ROUTES.TERMS ? (
        <LegalPage doc="terms" />
      ) : (
        <main>
          <Hero onGetStarted={() => navigate(ROUTES.SIGNUP)} />
        </main>
      )}

      <footer className="footer">
        <span className="dot" />
        <span>Clinic System — book visits, earn credits, run the practice.</span>
        <span className="footer-spacer" />
        <a className="legal-link" href={`#${ROUTES.PRIVACY}`}>Privacy Policy</a>
        <a className="legal-link" href={`#${ROUTES.TERMS}`}>Terms &amp; Conditions</a>
        <span className="footer-copy">© 2026 Clinic System. All rights reserved.</span>
      </footer>
      <BackToTop />
    </div>
  );
}

function AuthPage({ eyebrow, title, sub, form, switchTo }) {
  return (
    <main className="auth-page">
      <div className="auth-card glass">
        <div className="container">
          <h2 className="auth-page-title">
            <span className="eyebrow">{eyebrow}</span>
            {title}
          </h2>
          {sub && <p className="muted">{sub}</p>}
          {form}
          {switchTo && (
            <p className="auth-switch">
              <a href={switchTo.href}>{switchTo.text}</a>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

const LEGAL = {
  privacy: {
    title: 'Privacy Policy',
    paragraphs: [
      'Clinic System collects only the information needed to run your care: your account details, appointment requests and the clinics you visit. We never sell personal data.',
      'Your records are visible only to the roles that need them — your care team, your practice owner and system administrators. Every role change and appointment decision is written to an audit log.',
      'You can ask for a copy of your data, or for your account to be deactivated, at any time by contacting your clinic.',
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    paragraphs: [
      'By creating an account you agree to provide accurate information and to use appointment requests responsibly. Clinics may approve, reject or cancel requests.',
      'Accounts that misuse the system may be deactivated by an administrator. Availability shown in the app is indicative and is confirmed by the clinic.',
      'These terms may change as the service grows. Continued use of Clinic System means you accept the current version.',
    ],
  },
};

function LegalPage({ doc }) {
  const content = LEGAL[doc];
  if (!content) return null;
  return (
    <main className="auth-page legal-page">
      <div className="card">
        <h2><span className="eyebrow">Legal</span>{content.title}</h2>
        {content.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        <p className="auth-switch">
          <a href={`#${ROUTES.HOME}`}>Back to home</a>
        </p>
      </div>
    </main>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 320;
      setVisible(nearBottom);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      type="button"
      className={`to-top${visible ? ' show' : ''}`}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <IconArrowUp />
    </button>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
