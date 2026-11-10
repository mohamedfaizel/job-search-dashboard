'use client';

import { useMe } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { AccessPanel } from './components/AccessPanel';
import { LimitsPanel } from './components/LimitsPanel';
import { UsersPanel } from './components/UsersPanel';

const TABS = ['users', 'access', 'limits'] as const;
type Tab = (typeof TABS)[number];

/**
 * Admin: manage the accounts and settings of this server. Only admins get here from the avatar
 * menu; anyone else who types the address sees a short note, and the API refuses their calls
 * anyway.
 */
export function AdminPage() {
  const t = useTranslations('Admin');
  const { data: me } = useMe();
  const [tab, setTab] = useState<Tab>('users');
  if (!me) return null;

  // Arrow keys move between tabs, like any tab list.
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length] ?? 'users';
    setTab(next);
    document.getElementById(`admin-tab-${next}`)?.focus();
  };

  return (
    <section aria-labelledby="admin-heading" className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 id="admin-heading" className="text-xl font-semibold text-slate-900">
          {t('title')}
        </h1>
        {me.role === 'ADMIN' && <p className="text-xs text-slate-600">{t('intro')}</p>}
      </div>
      {me.role === 'ADMIN' ? (
        <>
          <div
            role="tablist"
            aria-label={t('tabs.label')}
            className="flex gap-1 overflow-x-auto border-b border-slate-300"
          >
            {TABS.map((id) => (
              <button
                key={id}
                id={`admin-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-controls={`admin-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onKeyDown={onKey}
                onClick={() => {
                  setTab(id);
                }}
                className="min-h-11 border-b-2 border-transparent px-3 text-sm whitespace-nowrap text-slate-600 hover:text-slate-900 aria-selected:border-slate-900 aria-selected:font-semibold aria-selected:text-slate-900 sm:px-4"
              >
                {t(`tabs.${id}`)}
              </button>
            ))}
          </div>
          <div id={`admin-panel-${tab}`} role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
            {tab === 'users' && <UsersPanel meId={me.id} />}
            {tab === 'access' && <AccessPanel />}
            {tab === 'limits' && <LimitsPanel />}
          </div>
        </>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {t('notAdmin')}
        </p>
      )}
    </section>
  );
}
