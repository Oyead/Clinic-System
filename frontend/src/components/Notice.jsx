import { useCallback, useState } from 'react';

// Inline notification rendered inside the section that produced it.
// kind: 'error' | 'success' | '' (neutral)
export function Notice({ notice }) {
  if (!notice || !notice.text) return null;
  return (
    <p className={`message${notice.kind ? ` ${notice.kind}` : ''}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.text}
    </p>
  );
}

export function useNotice() {
  const [notice, setNotice] = useState(null);
  const notify = useCallback((text, kind = 'error') => {
    setNotice(text ? { text, kind } : null);
  }, []);
  const clear = useCallback(() => setNotice(null), []);
  return [notice, notify, clear];
}
