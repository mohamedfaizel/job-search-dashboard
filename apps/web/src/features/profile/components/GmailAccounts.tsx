import {
  GMAIL_CONNECT_URL,
  useDisconnectGmail,
  useGmailStatus,
  useSyncGmail,
} from '@jobsearch/data';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

const RESULTS = ['connected', 'denied', 'error', 'not-configured'] as const;
type Result = (typeof RESULTS)[number];

/** What Google's sign-in left in the address (?gmail=connected). Only reads: no side effects. */
function cameBackWith(): Result | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('gmail');
  return RESULTS.find((known) => known === value) ?? null;
}

/** Takes ?gmail= out of the address so a reload doesn't show the result again. */
function clearCameBack(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('gmail')) return;
  url.searchParams.delete('gmail');
  window.history.replaceState(null, '', url);
}

/** Connect as many Gmail accounts as you like (read-only) and check them for employer replies. */
export function GmailAccounts() {
  const errorText = useErrorText();
  const t = useTranslations('Profile.mail');
  const format = useFormatter();
  const status = useGmailStatus();
  const sync = useSyncGmail();
  const disconnect = useDisconnectGmail();
  const [result] = useState(cameBackWith);
  // After the page has drawn: changing the address while drawing makes Next.js complain.
  useEffect(clearCameBack, []);

  const accounts = status.data?.accounts ?? [];
  const configured = status.data?.configured ?? false;

  return (
    <section
      aria-labelledby="mail-title"
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 id="mail-title" className="text-base font-semibold text-slate-900">
        {t('title')}
      </h2>
      <p className="text-sm text-slate-600">{t('intro')}</p>

      {result && (
        <p
          role={result === 'connected' ? 'status' : 'alert'}
          className={`rounded-md border p-3 text-sm ${
            result === 'connected'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {t(`result.${result}`)}
        </p>
      )}

      {status.isPending ? (
        <p className="text-sm text-slate-500">{t('loading')}</p>
      ) : status.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {t('loadFailed', { error: errorText(status.error) })}
        </p>
      ) : (
        <>
          {accounts.length === 0 ? (
            <p className="text-sm text-slate-500">{t('none')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{account.email}</p>
                    <p className="text-xs text-slate-500">
                      {account.lastSyncAt
                        ? t('lastChecked', {
                            date: format.dateTime(new Date(account.lastSyncAt), {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }),
                          })
                        : t('neverChecked')}
                    </p>
                    {account.lastError && (
                      <p role="alert" className="text-xs text-red-700">
                        {account.lastError}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={disconnect.isPending}
                    onClick={() => {
                      disconnect.mutate(account.id);
                    }}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    aria-label={t('disconnectLabel', { email: account.email })}
                  >
                    {t('disconnect')}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {configured ? (
              <a
                href={GMAIL_CONNECT_URL}
                className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-2 text-sm font-medium text-white"
              >
                {accounts.length === 0 ? t('connect') : t('connectAnother')}
              </a>
            ) : (
              <p className="text-sm text-amber-800">{t('notConfigured')}</p>
            )}
            {accounts.length > 0 && (
              <button
                type="button"
                disabled={sync.isPending}
                onClick={() => {
                  sync.mutate();
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {sync.isPending ? t('checking') : t('checkNow')}
              </button>
            )}
          </div>
          {sync.isError && (
            <p role="alert" className="text-sm text-red-700">
              {t('checkFailed', { error: errorText(sync.error) })}
            </p>
          )}
          {sync.data && (
            <div role="status" className="space-y-1 text-sm text-slate-700">
              <p>{t('checked', { count: sync.data.suggestions })}</p>
              {sync.data.warnings.map((warning) => (
                <p key={warning} className="text-red-700">
                  {warning}
                </p>
              ))}
            </div>
          )}
        </>
      )}
      <p className="text-xs text-slate-500">{t('privacy')}</p>
    </section>
  );
}
