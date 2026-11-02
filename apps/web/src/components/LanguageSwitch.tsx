'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { LOCALES, writeLocaleCookie } from '@/i18n/config';

/**
 * EN | DE buttons. Picking one saves it in a cookie and reloads the server parts of the page
 * in that language. onPick also saves it on your account when you are logged in.
 */
export function LanguageSwitch({ onPick }: { onPick?: (locale: Locale) => void }) {
  const current = useLocale();
  const t = useTranslations('Language');
  const router = useRouter();

  return (
    <div role="group" aria-label={t('label')} className="flex rounded-md ring-1 ring-slate-200">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          title={t(locale)}
          aria-label={t(locale)}
          aria-pressed={locale === current}
          onClick={() => {
            if (locale === current) return;
            writeLocaleCookie(locale);
            onPick?.(locale);
            router.refresh();
          }}
          className="px-2 py-1 text-xs font-medium text-slate-600 uppercase first:rounded-l-md last:rounded-r-md hover:bg-slate-100 aria-pressed:bg-brand-400 aria-pressed:text-black"
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
