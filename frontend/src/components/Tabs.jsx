import { useState } from 'react';

export function PanelTabs({ tabs, active, onChange, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label || 'Dashboard sections'}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`tab${active === t.id ? ' active' : ''}`}
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
