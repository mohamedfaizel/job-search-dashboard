'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

/** How long a short "Saved" note stays before it goes away by itself. */
export const AUTO_HIDE_MS = 4000;

/**
 * Shows its children, then hides them after `ms`. For short success notes ("Saved") that
 * shouldn't stay on screen. Give it a new `key` to show it again after the next save.
 */
export function AutoHide({ children, ms = AUTO_HIDE_MS }: { children: ReactNode; ms?: number }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShown(false);
    }, ms);
    return () => {
      clearTimeout(timer);
    };
  }, [ms]);
  return shown ? children : null;
}
