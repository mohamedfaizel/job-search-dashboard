'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { APP_NAME } from '@/lib/app-name';
import { FlagStripe } from './FlagStripe';
import { Logo } from './Logo';

/** How often the page asks the API again by itself. */
export const AUTO_RETRY_MS = 30_000;

/** A wifi symbol with a line through it. */
function OfflineIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-10 w-10 text-red-700"
    >
      <path d="M2 8.8a15 15 0 0 1 20 0" />
      <path d="M5 12.6a10 10 0 0 1 14 0" />
      <path d="M8.5 16.4a5 5 0 0 1 7 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}

/**
 * Shown when the API can't be reached (server down, or no internet). Plain words, no addresses
 * or commands: a Try again button, and the page also tries again by itself every 30 seconds.
 */
export function ServerDown({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const t = useTranslations('ServerDown');

  useEffect(() => {
    const timer = setInterval(onRetry, AUTO_RETRY_MS);
    return () => {
      clearInterval(timer);
    };
  }, [onRetry]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="bg-flag-black text-white">
        <div className="flex items-center gap-3 px-4 py-2.5 font-semibold sm:px-6">
          <Logo onDark className="h-9 w-9" />
          {APP_NAME}
        </div>
      </header>
      <FlagStripe afterBlack />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <section
          role="alert"
          className="flex w-full max-w-md flex-col items-center gap-3.5 rounded-2xl border border-slate-200 bg-white px-5 py-7 text-center sm:p-8"
        >
          <OfflineIcon />
          <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-[15px] leading-normal text-slate-600">{t('body')}</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="h-12 w-full rounded-lg bg-brand-400 px-6 font-bold text-black hover:bg-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60 sm:h-11 sm:w-auto"
          >
            {retrying ? t('trying') : t('tryAgain')}
          </button>
          <p className="text-[13px] text-slate-600">{t('auto')}</p>
        </section>
      </main>
    </div>
  );
}
