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
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(127,217,168,0.2)]" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="26" height="26">
        <circle cx="32" cy="32" r="30" className="fill-[var(--color-mint-dark)]" />
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
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(248,161,136,0.2)]" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="26" height="26">
        <circle cx="32" cy="32" r="30" className="fill-[var(--color-coral-dark)]" />
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
  }, [notice?.id, notice?.text, onClose]);

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
    <div className="pointer-events-none fixed bottom-4 left-4 z-[100] flex flex-col gap-3 sm:bottom-5 sm:left-5" aria-hidden="false">
      <div
        className={`relative flex w-[min(420px,calc(100vw_-_32px))] flex-row items-center gap-3 rounded-[24px] bg-white p-4 pr-11 shadow-[var(--shadow)] transition-all duration-300 ease-out ${leaving ? 'pointer-events-none translate-y-2 scale-95 opacity-0' : ''}`}
        role={isSuccess ? 'status' : 'alert'}
        aria-live={isSuccess ? 'polite' : 'assertive'}
      >
        <button type="button" className="absolute right-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-[1.3rem] font-normal leading-none text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-sand)] hover:text-[var(--color-ink)]" aria-label="Dismiss message" tabIndex={0} onClick={dismiss}>
          ×
        </button>
        {isSuccess ? <SuccessIcon /> : <ErrorIcon />}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="font-display text-[0.92rem] font-extrabold tracking-[-0.01em] text-[var(--color-ink)]">{isSuccess ? 'Success!' : 'Error!'}</h2>
          <p className="text-[0.78rem] font-normal leading-[1.55] text-[var(--color-ink-soft)] [overflow-wrap:anywhere]">{notice.text}</p>
        </div>
        <button
          type="button"
          className={`shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-[0.72rem] font-bold shadow-[var(--shadow-sm)] transition-colors ${isSuccess ? 'bg-[var(--color-sand)] text-[var(--color-ink)] hover:bg-[var(--color-sand-deep)]' : 'bg-[var(--color-ink)] text-white hover:bg-[#2a2a2a]'}`}
          onClick={dismiss}
        >
          {isSuccess ? 'Continue' : 'Try Again'}
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
