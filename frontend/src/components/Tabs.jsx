import { useState } from 'react';

export function PanelTabs({ tabs, active, onChange, label }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full bg-[var(--color-sand)] p-1.5" role="tablist" aria-label={label || 'Dashboard sections'}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`flex-1 cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-[0.8rem] font-display font-bold transition-colors ${active === t.id ? 'bg-[var(--color-ink)] text-white shadow-[var(--shadow-sm)]' : 'text-[var(--color-ink-soft)] hover:bg-white/70 hover:text-[var(--color-ink)]'}`}
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
