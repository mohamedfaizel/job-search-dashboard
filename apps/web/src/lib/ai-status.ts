import { useMe, useMyApiKeys, useResumeMatcherStatus } from '@jobsearch/data';
import { useSyncExternalStore } from 'react';

/**
 * Can the paid AI parts (Resume-Matcher, which calls your AI with your own key) run now?
 *
 * - notSetUp: RESUME_MATCHER_URL is not set in .env.
 * - notRunning: Resume-Matcher does not answer (checked for free every minute).
 * - noKey: you have no key saved for the AI you picked in Settings > API keys.
 * - keyFailed: the last AI run or key test failed with a key or credit error, so the key is
 *   missing, expired or out of credits. A run or test that works clears it.
 */
export type AiState = 'on' | 'notSetUp' | 'notRunning' | 'noKey' | 'keyFailed';

const KEY = 'jobsearch.aiKeyFailed';
const listeners = new Set<() => void>();
// The value in memory too, for when storage is blocked.
let memory: string | null = null;
let loaded = false;

/** Words an AI provider's error uses when the key is wrong, expired or out of credits. */
const KEY_ERROR =
  /\b401\b|\b403\b|api[ _-]?key|x-api-key|authenticat|unauthori[sz]ed|credit|billing|quota|insufficient|expired|permission/i;

export function isKeyError(message: string | null | undefined): boolean {
  return Boolean(message && KEY_ERROR.test(message));
}

function read(): string | null {
  if (!loaded) {
    loaded = true;
    try {
      memory = localStorage.getItem(KEY);
    } catch {
      // Private windows can block storage; memory still works for this visit.
    }
  }
  return memory;
}

function write(value: string | null) {
  if (read() === value) return;
  memory = value;
  try {
    if (value === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
  } catch {
    // See read().
  }
  listeners.forEach((listener) => {
    listener();
  });
}

/** Tells what an AI run or key test ended with: ok clears the flag, a key error sets it. */
export function noteAiResult(ok: boolean, error?: string | null) {
  if (ok) write(null);
  else if (isKeyError(error)) write(error ?? 'key');
}

/** The key test said the key is missing or doesn't work. */
export function markKeyFailed(message: string) {
  write(message || 'key');
}

/** For tests: forget the saved state. */
export function resetAiStatus() {
  memory = null;
  loaded = false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAiState(): AiState {
  const failed = useSyncExternalStore(subscribe, read, () => null);
  const status = useResumeMatcherStatus();
  const keys = useMyApiKeys();
  const { data: me } = useMe();
  // While loading or when the check itself fails, don't block anything.
  if (status.data && !status.data.configured) return 'notSetUp';
  if (status.data && !status.data.reachable) return 'notRunning';
  if (keys.data && me && !keys.data.some((key) => key.kind === me.aiProvider)) return 'noKey';
  if (failed) return 'keyFailed';
  return 'on';
}
