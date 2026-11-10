'use client';

import { useMe } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { UsersPanel } from './components/UsersPanel';

/**
 * Admin: manage the accounts on this server. Only admins get here from the avatar menu; anyone
 * else who types the address sees a short note, and the API refuses their calls anyway.
 */
export function AdminPage() {
  const t = useTranslations('Admin');
  const { data: me } = useMe();
  if (!me) return null;

  return (
    <section aria-labelledby="admin-heading" className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 id="admin-heading" className="text-xl font-semibold text-slate-900">
          {t('title')}
        </h1>
        {me.role === 'ADMIN' && <p className="text-xs text-slate-600">{t('intro')}</p>}
      </div>
      {me.role === 'ADMIN' ? (
        <UsersPanel meId={me.id} />
      ) : (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {t('notAdmin')}
        </p>
      )}
    </section>
  );
}
