import { useEffect, useRef, useState } from 'react';

export function PanelTabs({ tabs, active, onChange, label }) {
  const listRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    const el = activeRef.current;
    if (!list || !el) return;
    const listRect = list.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target = list.scrollLeft + (elRect.left - listRect.left) - (list.clientWidth - elRect.width) / 2;
    list.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [active]);

  return (
    <div
      ref={listRef}
      className="flex gap-1 overflow-x-auto rounded-[20px] bg-[var(--color-sand)] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:rounded-full"
      role="tablist"
      aria-label={label || 'Dashboard sections'}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={active === t.id ? activeRef : null}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`shrink-0 flex-none cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-[0.8rem] font-display font-bold transition-colors sm:flex-1 ${active === t.id ? 'bg-[var(--color-ink)] text-white shadow-[var(--shadow-sm)]' : 'text-[var(--color-ink-soft)] hover:bg-white/70 hover:text-[var(--color-ink)]'}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function usePersistentTab(storageKey, defaultTab, validIds) {
  const [tab, setTabState] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && validIds.includes(saved)) return saved;
    } catch (_) {
    }
    return defaultTab;
  });
  const setTab = (id) => {
    setTabState(id);
    try {
      localStorage.setItem(storageKey, id);
    } catch (_) {
    }
  };
  return [tab, setTab];
}
