import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const FADE_MS = 400;
const MIN_VISIBLE_MS = 2500;
const MAX_VISIBLE_MS = 10000;

export function popupDurationMs(text) {
  const str = typeof text === 'string' ? text : textToString(text);
  const words = str.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return MIN_VISIBLE_MS;
  const scaled = Math.ceil(words / 4) * 1000;
  return Math.min(MAX_VISIBLE_MS, Math.max(MIN_VISIBLE_MS, scaled));
}

function textToString(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textToString).join(' ');
  if (typeof node === 'object' && node.props) return textToString(node.props.children);
  return '';
}

function SuccessIcon() {
  return (
    <span className="popup-icon popup-icon-success" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle cx="32" cy="32" r="30" className="popup-icon-ring-success" />
        <path
          d="M20 33.5 28.5 42 44 25"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function ErrorIcon() {
  return (
    <span className="popup-icon popup-icon-error" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle cx="32" cy="32" r="30" className="popup-icon-ring-error" />
        <path
          d="M23 23l18 18M41 23L23 41"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Notice({ notice, onClose }) {
  const [leaving, setLeaving] = useState(false);
  const timers = useRef([]);

  const dismiss = useCallback(() => {
    setLeaving(true);
    const t = setTimeout(() => {
      onClose?.();
    }, FADE_MS);
    timers.current.push(t);
  }, [onClose]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLeaving(false);
    if (!notice || !notice.text) return undefined;
    const visibleMs = popupDurationMs(notice.text);
    const hideTimer = setTimeout(() => setLeaving(true), visibleMs);
    const closeTimer = setTimeout(() => onClose?.(), visibleMs + FADE_MS);
    timers.current.push(hideTimer, closeTimer);
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [notice?.id, notice?.text, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notice?.text) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notice?.text, dismiss]);

  if (!notice || !notice.text) return null;

  const isSuccess = notice.kind === 'success';

  return createPortal(
    <div className="popup-stack" aria-hidden="false">
      <div
        className={`popup popup-${isSuccess ? 'success' : 'error'}${leaving ? ' leaving' : ''}`}
        role={isSuccess ? 'status' : 'alert'}
        aria-live={isSuccess ? 'polite' : 'assertive'}
      >
        <button type="button" className="popup-close" aria-label="Dismiss message" tabIndex={0} onClick={dismiss}>
          ×
        </button>
        {isSuccess ? <SuccessIcon /> : <ErrorIcon />}
        <div className="popup-main">
          <h2 className="popup-title">{isSuccess ? 'Success!' : 'Error!'}</h2>
          <p className="popup-text">{notice.text}</p>
        </div>
        <button
          type="button"
          className={`popup-action popup-action-${isSuccess ? 'success' : 'error'}`}
          onClick={dismiss}
        >
          {isSuccess ? 'Continue Browsing' : 'Try Again'}
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function useNotice() {
  const [queue, setQueue] = useState([]);
  const notify = useCallback((text, kind = 'error') => {
    if (!text) {
      setQueue([]);
      return;
    }
    const id = Date.now() + Math.random();
    setQueue((q) => [...q, { id, text, kind }]);
  }, []);
  const dismissCurrent = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);
  const clear = useCallback(() => {
    setQueue([]);
  }, []);
  return [queue[0] || null, notify, dismissCurrent, clear, queue.length];
}
