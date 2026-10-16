import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PasswordInput } from './SecretField.jsx';

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
  }, [open ]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal glass"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2><span className="eyebrow">{eyebrow}</span>{title}</h2>
        {message && <p>{message}</p>}
        <div className="modal-actions">
          <button type="button" ref={cancelRef} className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-confirm'}
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
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal glass"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2><span className="eyebrow">Reinstate user</span>{title}</h2>
        {message && <p>{message}</p>}
        <form noValidate onSubmit={submit}>
          <label>
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
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-confirm" disabled={busy}>
              {busy ? 'Working…' : 'Set password'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
