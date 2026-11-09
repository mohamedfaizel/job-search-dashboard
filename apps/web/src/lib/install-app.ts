'use client';

import { useCallback, useEffect, useState } from 'react';

/** Chrome and Edge fire this before they offer to install the app; we keep it for our button. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * installed: the app already runs in its own window. prompt: the browser can install it on a
 * click. ios: Safari has no install button, you add it via Share › Add to Home Screen.
 * none: this browser can't install it (yet).
 */
export type InstallState = 'installed' | 'prompt' | 'ios' | 'none';

function runsInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    iosStandalone ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  );
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function initialState(): InstallState {
  if (typeof window === 'undefined') return 'none';
  if (runsInstalled()) return 'installed';
  return isIos() ? 'ios' : 'none';
}

/** Whether this browser can install the app, and a function that opens its install prompt. */
export function useInstallApp(): { state: InstallState; install: () => Promise<void> } {
  const [state, setState] = useState<InstallState>(initialState);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const offer = (event: Event) => {
      event.preventDefault(); // keep the browser's own banner away; our menu item shows instead
      setPrompt(event as InstallPromptEvent);
      setState('prompt');
    };
    const installed = () => {
      setPrompt(null);
      setState('installed');
    };
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null); // a prompt can be used only once
    setState(choice.outcome === 'accepted' ? 'installed' : 'none');
  }, [prompt]);

  return { state, install };
}
