import type { RefObject } from 'react';
import { useEffect } from 'react';

/** Closes a pop-up (a menu or a list) on a click outside `box` or on Escape, while it is open. */
export function useDismiss(open: boolean, box: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, box, close]);
}
