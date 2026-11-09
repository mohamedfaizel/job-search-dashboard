'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js, which lets the installed app open offline. Only in a production build:
 * in `pnpm dev` the files change all the time and a cache would show old code.
 */
export function ServiceWorker({ enabled = process.env.NODE_ENV === 'production' }) {
  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No service worker (for example a private window): the app still works online.
    });
  }, [enabled]);
  return null;
}
