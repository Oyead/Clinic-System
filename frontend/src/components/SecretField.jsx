import { useState } from 'react';
import { IconEye, IconEyeOff } from './icons.jsx';

function EyeButton({ visible, onToggle, label }) {
  return (
    <button
      type="button"
      className="secret-toggle"
      aria-label={visible ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={visible}
      title={visible ? `Hide ${label}` : `Show ${label}`}
      onClick={onToggle}
    >
      {visible ? <IconEyeOff /> : <IconEye />}
    </button>
  );
}

export function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="secret-wrap">
      <input {...props} type={show ? 'text' : 'password'} />
      <EyeButton visible={show} onToggle={() => setShow((s) => !s)} label="password" />
    </div>
  );
}

export function TokenReveal({ token, title = 'Invite token' }) {
  const [show, setShow] = useState(true);
  const [copied, setCopied] = useState(false);
  if (!token) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      setCopied(false);
    }
  };

  return (
    <div className="token-box" role="status" aria-label={title}>
      <div className="token-head">
        <span className="token-title">{title}</span>
        <EyeButton visible={show} onToggle={() => setShow((s) => !s)} label="invite token" />
      </div>
      <div className="token-row">
        <input
          className="token-value"
          readOnly
          value={token}
          type={show ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          onFocus={(e) => e.target.select()}
          aria-label="Invite token value"
        />
        <button type="button" className="token-copy" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="token-note">Share this with the invitee. It is shown once and expires in days.</p>
    </div>
  );
}
