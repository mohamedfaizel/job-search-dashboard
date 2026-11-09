'use client';

import { useTranslations } from 'next-intl';

/** The last step: one big download button (waits while a change is still being saved). */
export function DownloadCard({ href, waiting }: { href: string; waiting: boolean }) {
  const t = useTranslations('Resume.downloadStep');
  return (
    <section
      aria-labelledby="download-heading"
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="download-heading" className="text-lg font-semibold text-slate-900">
        {t('title')}
      </h2>
      <p className="text-sm text-slate-600">{t('intro')}</p>
      {waiting ? (
        <span
          aria-disabled
          className="inline-block cursor-not-allowed rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white opacity-50"
        >
          ⬇ {t('button')}
        </span>
      ) : (
        <a
          href={href}
          className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          ⬇ {t('button')}
        </a>
      )}
    </section>
  );
}
