'use client';

import { useEffect } from 'react';
import { useBuilderStore } from '@/store/builderStore';

/**
 * Syncs the Zustand theme state to the `<html>` element's class list.
 * Must be rendered inside the client boundary (not in layout.tsx which is RSC).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useBuilderStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return <>{children}</>;
}
