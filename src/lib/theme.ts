import { useEffect, useState } from 'react';
import { browserStorage } from './storage';

const STORAGE_KEY = 'order-dashboard:theme';

type Theme = 'light' | 'dark';

/** The first value is set by the inline script of index.html, before React starts. */
export function useTheme(): [theme: Theme, toggle: () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = (event: MediaQueryListEvent) => {
      const chosen = browserStorage('local')?.getItem(STORAGE_KEY);
      if (!chosen) setTheme(event.matches ? 'dark' : 'light');
    };
    system.addEventListener('change', followSystem);
    return () => system.removeEventListener('change', followSystem);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    browserStorage('local')?.setItem(STORAGE_KEY, next);
    setTheme(next);
  };

  return [theme, toggle];
}
