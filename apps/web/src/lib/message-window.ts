import { useSyncExternalStore } from 'react';

/*
 * Whether the "Message Mohamed Faizel" window is open. The footer line, the account menu, the
 * About us page and the bell can all open it, so the state lives here, outside any one of them.
 */

let open = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

export const openMessageWindow = () => {
  set(true);
};
export const closeMessageWindow = () => {
  set(false);
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMessageWindowOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
