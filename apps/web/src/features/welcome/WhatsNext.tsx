'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

/** The four things to know after setup: shown on the last Welcome step and in What's new. */
const TILES = [
  { id: 'autopilot', icon: '🎯', href: '/jobs/add' },
  { id: 'bell', icon: '🔔', href: null },
  { id: 'mail', icon: '✉', href: '/settings?tab=gmail' },
  { id: 'help', icon: '?', href: null },
] as const;

/**
 * Four small tiles: Autopilot, the bell, Gmail and the weekly report, and the ? chat box.
 * `onGo` replaces the plain links (Welcome must finish the setup before leaving the page).
 */
export function WhatsNext({ onGo }: { onGo?: (href: string) => void }) {
  const t = useTranslations('Welcome.whatsNext');
  return (
    <div className="space-y-2">
      <ul className="grid gap-2 sm:grid-cols-2">
        {TILES.map(({ id, icon, href }) => (
          <li key={id} className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              <span aria-hidden className="w-5 text-center">
                {icon}
              </span>
              {href && onGo ? (
                <button
                  type="button"
                  onClick={() => {
                    onGo(href);
                  }}
                  className="text-left font-semibold underline hover:text-slate-700"
                >
                  {t(`${id}Title`)}
                </button>
              ) : href ? (
                <Link href={href} className="underline hover:text-slate-700">
                  {t(`${id}Title`)}
                </Link>
              ) : (
                t(`${id}Title`)
              )}
            </p>
            <p className="mt-1 text-slate-600">{t(id)}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-600">{t('never')}</p>
    </div>
  );
}
