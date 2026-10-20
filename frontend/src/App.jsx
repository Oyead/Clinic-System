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
import { BTN_INK, EYEBROW, statusPill } from './components/ui.js';

const NAV_LINKS = [
  { path: ROUTES.SIGNUP, label: 'Patient sign up' },
  { path: ROUTES.SIGNUP_CLINIC, label: 'Clinic sign up' },
  { path: ROUTES.ACCEPT_INVITE, label: 'Accept invite' },
  { path: ROUTES.SIGNIN, label: 'Sign in' },
];

function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[linear-gradient(155deg,#f8f3eb_0%,#f3ebdd_46%,#eee3d1_100%)]">
      <div className="absolute -right-[20%] top-[6%] h-[78vh] w-[78vh] rounded-[46%_54%_58%_42%/52%_44%_56%_48%] bg-[radial-gradient(circle_at_42%_42%,rgba(245,196,77,0.46),rgba(228,205,163,0.3)_54%,transparent_72%)] blur-[100px]" />
    </div>
  );
}

function Shell() {
  const { token, role, email, name, status, pendingVerification, signout } = useAuth();
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
  const fallbackName = email
    ? email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
  const displayName = name?.trim() || fallbackName || 'there';

  const handleSignout = () => {
    signout();
    navigate(ROUTES.HOME);
  };

  const afterAuth = () => navigate(ROUTES.HOME);

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-4 pb-16 pt-5 sm:px-6 sm:pt-7" id="top">
      <header className="flex flex-wrap items-center gap-3 rounded-[24px] bg-white px-4 py-3.5 shadow-[var(--shadow)] sm:gap-4 sm:px-6 sm:py-4">
        <a className="flex items-center gap-3" href={`#${ROUTES.HOME}`} aria-label="Clinic System home">
          <LogoEmblem size={48} />
          <span>
            <span className="block font-display text-[1.15rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--color-ink)]">Clinic System</span>
            <span className="block text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">Care, levelled up</span>
          </span>
        </a>
        <div className="flex-1" />
        {signedIn ? (
          <button type="button" className={`${BTN_INK} px-4 py-2 text-xs`} onClick={handleSignout}>
            Sign out
          </button>
        ) : (
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a
                key={l.path}
                href={`#${l.path}`}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-[0.8rem] font-bold transition-colors ${path === l.path ? 'bg-[var(--color-ink)] text-white shadow-[var(--shadow-sm)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-sand)] hover:text-[var(--color-ink)]'}`}
              >
                {l.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {signedIn ? (
        <main className="flex flex-col gap-5">
          {meta && (
            <div className="relative overflow-hidden rounded-[24px] bg-[var(--color-mustard)] p-6 shadow-[var(--shadow)] sm:p-8" role="status">
              <div className="relative flex flex-wrap items-center gap-2">
                <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[#6b5109] [overflow-wrap:anywhere]">Hi, {displayName}</span>
                {status && <span className={statusPill(status)}>{status.replaceAll('_', ' ')}</span>}
              </div>
              <p className="relative mt-2 text-[0.88rem] leading-[1.6] text-[#4a3606]">{meta.sub}</p>
            </div>
          )}
          {pendingVerification && (
            <div className="rounded-[24px] bg-white px-6 py-5 shadow-[var(--shadow-sm)]">
              <p className="text-[0.9rem] font-medium text-[var(--color-ink-soft)]" role="status">
                Your clinic is pending platform verification. You can sign in, but staff invites unlock after approval.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-4">
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

      <footer className="mt-2 flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] pt-6 text-[0.8rem] text-[var(--color-ink-soft)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-mustard)]" />
        <span>Clinic System - book visits, earn credits, run the practice.</span>
        <span className="flex-1" />
        <a href={`#${ROUTES.PRIVACY}`} className="rounded-full bg-white px-4 py-1.5 font-display text-[0.78rem] font-bold text-[var(--color-ink)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-sand)]">Privacy Policy</a>
        <a href={`#${ROUTES.TERMS}`} className="rounded-full bg-white px-4 py-1.5 font-display text-[0.78rem] font-bold text-[var(--color-ink)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-sand)]">Terms &amp; Conditions</a>
        <span className="w-full text-[0.74rem] text-[var(--color-ink-soft)]/80">© 2026 Clinic System. All rights reserved.</span>
      </footer>
      <BackToTop />
    </div>
  );
}

function AuthPage({ eyebrow, title, sub, form, switchTo }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center py-4">
      <div className="w-full max-w-[560px] rounded-[24px] bg-white p-6 shadow-[var(--shadow)] sm:p-9">
        <div className="flex flex-col gap-5">
          <div>
            <span className={EYEBROW}>{eyebrow}</span>
            <h2 className="mt-2 font-display text-[2rem] font-extrabold leading-tight tracking-[-0.04em] text-[var(--color-ink)] sm:text-[2.3rem]">
              {title}
            </h2>
            {sub && <p className="mt-2 text-[0.92rem] leading-[1.65] text-[var(--color-ink-soft)]">{sub}</p>}
          </div>
          {form}
          {switchTo && (
            <p className="text-center text-[0.88rem] text-[var(--color-ink-soft)]">
              <a href={switchTo.href} className="font-bold text-[var(--color-ink)] underline decoration-[var(--color-mustard)] decoration-2 underline-offset-4 hover:decoration-[var(--color-ink)]">{switchTo.text}</a>
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
      'Your records are visible only to the roles that need them - your care team, your practice owner and system administrators. Every role change and appointment decision is written to an audit log.',
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
    <main className="flex min-h-[60vh] items-center justify-center py-4">
      <div className="w-full max-w-[620px] rounded-[24px] bg-white p-6 shadow-[var(--shadow)] sm:p-9">
        <span className={EYEBROW}>Legal</span>
        <h2 className="mt-2 font-display text-[2rem] font-extrabold leading-tight tracking-[-0.04em] text-[var(--color-ink)]">{content.title}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {content.paragraphs.map((p, i) => (
            <p key={i} className="text-[0.9rem] leading-[1.7] text-[var(--color-ink-soft)]">{p}</p>
          ))}
        </div>
        <p className="mt-6 text-center text-[0.88rem]">
          <a href={`#${ROUTES.HOME}`} className="font-bold text-[var(--color-ink)] underline decoration-[var(--color-mustard)] decoration-2 underline-offset-4 hover:decoration-[var(--color-ink)]">Back to home</a>
        </p>
      </div>
    </main>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setVisible(window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 320);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      type="button"
      className={`fixed bottom-4 right-4 z-40 flex cursor-pointer h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--color-ink)] text-white shadow-[0_16px_30px_-14px_rgba(17,17,17,0.7)] transition-all duration-200 hover:bg-[#2a2a2a] sm:bottom-[26px] sm:right-[26px] sm:h-[56px] sm:w-[56px] ${visible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-[12px] opacity-0'}`}
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
      <div className="relative min-h-screen">
        <Backdrop />
        <Shell />
      </div>
    </AuthProvider>
  );
}
