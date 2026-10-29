import { useSyncExternalStore } from 'react';

// Tailwind's `md` breakpoint: below it the job list shows cards instead of a table.
const QUERY = '(max-width: 767px)';

function subscribe(onChange: () => void) {
  // Test browsers (jsdom) have no matchMedia; they get the desktop table.
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
}

const isPhone = () => typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;

/** True on a phone-sized screen. Updates when the window is resized or the phone turned. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, isPhone, () => false);
}
