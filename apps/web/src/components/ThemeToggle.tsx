'use client';

import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    try {
      const t = localStorage.getItem('mm-theme');
      if (t === 'light' || t === 'dark') setTheme(t);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const apply = (t: Theme) => {
    setTheme(t);
    try {
      if (t === 'system') {
        localStorage.removeItem('mm-theme');
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem('mm-theme', t);
        document.documentElement.dataset.theme = t;
      }
    } catch {
      /* storage unavailable */
    }
  };

  const next: Theme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
  return (
    <button
      type="button"
      className="btn ghost small"
      onClick={() => apply(next)}
      aria-label={`Theme: ${theme}. Switch to ${next}`}
      title={`Theme: ${theme}`}
    >
      {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}
    </button>
  );
}
