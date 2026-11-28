'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { markWhatsNewSeen, subscribeWhatsNew, whatsNewSeen } from './whats-new-seen';
import { WhatsNext } from './WhatsNext';

/** My Jobs, once: the same four tiles as the last setup step, for accounts made before them. */
export function WhatsNewCard() {
  const t = useTranslations('Welcome.whatsNew');
  // The server has no localStorage, so it renders nothing (as if seen).
  const seen = useSyncExternalStore(subscribeWhatsNew, whatsNewSeen, () => true);
  if (seen) return null;

  return (
    <section
      aria-labelledby="whats-new-title"
      className="space-y-2 rounded-lg border border-brand-300 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="whats-new-title" className="font-semibold text-slate-900">
            {t('title')}
          </h2>
          <p className="text-sm text-slate-600">{t('intro')}</p>
        </div>
        <button
          type="button"
          aria-label={t('close')}
          title={t('close')}
          onClick={() => {
            markWhatsNewSeen();
          }}
          className="grid size-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
        >
          ✕
        </button>
      </div>
      <WhatsNext />
    </section>
  );
}
