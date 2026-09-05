'use client';

import { useEffect, useState } from 'react';

const storageKey = 'oceanheart-theme';

export function ThemeToggle() {
  const [monochrome, setMonochrome] = useState(false);
  useEffect(() => {
    const sync = () => setMonochrome(document.documentElement.dataset.theme === 'monochrome');
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      document.documentElement.dataset.theme = event.newValue === 'monochrome' ? 'monochrome' : 'coastal';
      sync();
    };
    sync();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = () => {
    const next = document.documentElement.dataset.theme !== 'monochrome';
    document.documentElement.dataset.theme = next ? 'monochrome' : 'coastal';
    setMonochrome(next);
    try { localStorage.setItem(storageKey, next ? 'monochrome' : 'coastal'); } catch { /* Switching still works when storage is unavailable. */ }
  };

  const label = monochrome ? 'Switch to coastal theme' : 'Switch to monochrome theme';
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
    <svg className="theme-moon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /></svg>
    <svg className="theme-sun" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></svg>
  </button>;
}
