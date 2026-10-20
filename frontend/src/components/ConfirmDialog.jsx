import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PasswordInput } from './SecretField.jsx';
import { SURFACE, MODAL_BACKDROP, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, EYEBROW } from './ui.js';

function useEscape(onEscape, active) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onEscape?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
}

export function ConfirmDialog({
  open,
  title,
  message,
  eyebrow = 'Please confirm',
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  useEscape(onCancel, open);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className={MODAL_BACKDROP} onClick={onCancel}>
      <div
        className={`${SURFACE} w-full max-w-[520px] p-6 sm:p-8`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={EYEBROW}>{eyebrow}</span>
        <h2 className="mb-2 mt-1.5 font-display text-[1.7rem] font-extrabold leading-tight tracking-[-0.03em] text-[var(--color-ink)]">
          {title}
        </h2>
        {message && <p className="text-[0.92rem] leading-[1.7] text-[var(--color-ink-soft)]">{message}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            ref={cancelRef}
            className={`${BTN_SECONDARY} px-6 py-2.5 text-sm`}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${danger ? BTN_DANGER : BTN_PRIMARY} px-7 py-2.5 text-sm`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PasswordDialog({ open, title, message, busy = false, onSubmit, onCancel }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEscape(onCancel, open);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    onSubmit?.(password);
  };

  return createPortal(
    <div className={MODAL_BACKDROP} onClick={onCancel}>
      <div
        className={`${SURFACE} w-full max-w-[520px] p-6 sm:p-8`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={EYEBROW}>Reinstate user</span>
        <h2 className="mb-2 mt-1.5 font-display text-[1.7rem] font-extrabold leading-tight tracking-[-0.03em] text-[var(--color-ink)]">{title}</h2>
        {message && <p className="text-[0.92rem] leading-[1.7] text-[var(--color-ink-soft)]">{message}</p>}
        <form noValidate onSubmit={submit} className="mt-4">
          <label className="flex flex-col gap-2 text-[0.8rem] font-bold text-[var(--color-ink)]">
            New password (min 8 characters)
            <PasswordInput
              autoFocus
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setError(''); setPassword(e.target.value); }}
            />
          </label>
          {error && <p className="mt-3 rounded-[16px] bg-[rgba(248,161,136,0.18)] px-4 py-3 text-[0.82rem] font-medium text-[#a8442d]" role="alert">{error}</p>}
          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            <button type="button" className={`${BTN_SECONDARY} px-6 py-2.5 text-sm`} onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className={`${BTN_PRIMARY} px-7 py-2.5 text-sm`} disabled={busy}>
              {busy ? 'Working…' : 'Set password'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
