/**
 * "What's new" on My Jobs shows once. It is remembered in this browser only; finishing the
 * first-login setup counts as seen, since its last step shows the same tiles.
 */
const KEY = 'jsh.whatsNew.2026-11';

export function whatsNewSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    // No storage (private window): don't nag, show nothing.
    return true;
  }
}

const listeners = new Set<() => void>();

/** For useSyncExternalStore: tells the card when it was closed. */
export function subscribeWhatsNew(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markWhatsNewSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Nothing to remember in.
  }
  listeners.forEach((listener) => {
    listener();
  });
}
