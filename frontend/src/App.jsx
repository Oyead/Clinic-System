import { useEffect, useRef, useState } from 'react';
import { AuthProvider, ROLE_META, useAuth } from './context/AuthContext.jsx';
import { AuthForms } from './components/AuthForms.jsx';
import { AdminPanel } from './components/AdminPanel.jsx';
import { StaffPanel } from './components/StaffPanel.jsx';
import { OwnerPanel } from './components/OwnerPanel.jsx';
import { PatientPanel } from './components/PatientPanel.jsx';
import { Hero } from './components/Hero.jsx';
import { LogoEmblem } from './components/LogoEmblem.jsx';
import { IconStar, IconFlame, IconPlusCross, IconArrowUp } from './components/icons.jsx';

function Shell() {
  const { token, role, email, message, signout, showMessage } = useAuth();
  const authRef = useRef(null);
  const [legal, setLegal] = useState(null);

  useEffect(() => {
    const meta = role ? ROLE_META[role] : null;
    if (token && meta) {
      document.body.dataset.role = meta.theme;
    } else {
      delete document.body.dataset.role;
    }
  }, [token, role]);

  const meta = role ? ROLE_META[role] : null;
  const signedIn = Boolean(token);

  const scrollToAuth = () => {
    authRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="app-frame" id="top">
      <header className="topbar glass">
        <div className="brand">
          <LogoEmblem size={56} />
          <div>
            <span className="brand-name">Clinic System</span>
            <span className="brand-tag">Care, levelled up</span>
          </div>
        </div>
        <div className="topbar-spacer" />
        {signedIn ? (
          <div className="session-chip">
            <span>{email} · {role}</span>
            <button
              type="button"
              onClick={() => { signout(); showMessage('Signed out.', 'success'); }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="session-chip">
            <span>New here?</span>
            <button type="button" onClick={scrollToAuth}>Join the platform</button>
          </div>
        )}
      </header>

      <p className={`message${message.kind ? ` ${message.kind}` : ''}`} aria-live="polite">
        {message.text}
      </p>

      {!signedIn && (
        <main>
          <Hero onGetStarted={scrollToAuth} />
          <section className="auth-section" id="join" ref={authRef} aria-label="Sign up or sign in">
            <aside className="auth-aside">
              <h2>Join the game of showing up.</h2>
              <p>
                Create your account to book visits, earn platform credits and
                keep your Reliable Patient badge. Clinics approve your requests — you collect the rewards.
              </p>
              <ul className="auth-points">
                <li><IconStar width={18} height={18} /> Badges for early bookings and checkups</li>
                <li><IconFlame width={18} height={18} /> Credits for every completed visit</li>
                <li><IconPlusCross width={18} height={18} /> One account for every clinic in the system</li>
              </ul>
            </aside>
            <div className="auth-card glass">
              <div className="container">
                <AuthForms />
              </div>
            </div>
          </section>
        </main>
      )}

      {signedIn && (
        <main className="dashboard">
          {meta && (
            <div className="role-banner" role="status">
              <span>{meta.title}</span>
              <small>{meta.sub} — signed in as {email} ({role})</small>
            </div>
          )}
          <div className="container">
            {role === 'admin' && <AdminPanel />}
            {(role === 'doctor' || role === 'receptionist') && <StaffPanel />}
            {role === 'owner' && <OwnerPanel />}
            {role === 'patient' && <PatientPanel />}
          </div>
        </main>
      )}

      <footer className="footer">
        <span className="dot" />
        <span>Clinic System — book visits, earn credits, run the practice.</span>
        <span className="footer-spacer" />
        <button type="button" className="legal-link" onClick={() => setLegal('privacy')}>Privacy Policy</button>
        <button type="button" className="legal-link" onClick={() => setLegal('terms')}>Terms &amp; Conditions</button>
        <span className="footer-copy">© 2026 Clinic System. All rights reserved.</span>
      </footer>
      {legal && <LegalModal doc={legal} onClose={() => setLegal(null)} />}
      <BackToTop />
    </div>
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

function LegalModal({ doc, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const content = LEGAL[doc];
  if (!content) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal glass"
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{content.title}</h2>
        {content.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        <button type="button" className="modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
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
