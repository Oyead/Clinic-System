import { useState } from 'react';
import { IconEye, IconEyeOff } from './icons.jsx';
import { FORM_INPUT, BTN_INK, BTN_ICON } from './ui.js';

function EyeButton({ visible, onToggle, label, overlay = false }) {
  return (
    <button
      type="button"
      className={overlay ? `${BTN_ICON} absolute right-1.5 top-1/2 -translate-y-1/2` : BTN_ICON}
      aria-label={visible ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={visible}
      title={visible ? `Hide ${label}` : `Show ${label}`}
      onClick={onToggle}
    >
      {visible ? <IconEyeOff /> : <IconEye />}
    </button>
  );
}

export function PasswordInput({ className = '', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex items-center">
      <input {...props} type={show ? 'text' : 'password'} className={`${FORM_INPUT} ${className} pr-14`} />
      <EyeButton overlay visible={show} onToggle={() => setShow((s) => !s)} label="password" />
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
    <div className="mt-3 flex flex-col gap-3 rounded-[20px] bg-[var(--color-sand)] p-4" role="status" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.85rem] font-bold text-[var(--color-ink)]">{title}</span>
        <EyeButton visible={show} onToggle={() => setShow((s) => !s)} label="invite token" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className={`${FORM_INPUT} flex-1 bg-white`}
          readOnly
          value={token}
          type={show ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          onFocus={(e) => e.target.select()}
          aria-label="Invite token value"
        />
        <button type="button" className={`${BTN_INK} px-5 py-2.5 text-xs`} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-[0.76rem] leading-[1.55] text-[var(--color-ink-soft)]">Share this with the invitee. It is shown once and expires in days.</p>
    </div>
  );
}
