import { useGmailStatus, useSyncGmail } from '@jobsearch/data';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useErrorText } from '../../../i18n/useErrorText';

/**
 * "Check Gmail now" on the Tracker, next to the suggestions it finds. Accounts are connected in
 * Settings > Gmail; without one it links there (only when the server has Google set up).
 */
export function GmailCheck() {
  const errorText = useErrorText();
  const t = useTranslations('Tracker.gmailCheck');
  const status = useGmailStatus();
  const sync = useSyncGmail();

  if (!status.data?.configured) return null;
  if (status.data.accounts.length === 0) {
    return (
      <Link href="/settings?tab=gmail" className="text-brand-700 text-sm underline">
        {t('connect')}
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        disabled={sync.isPending}
        onClick={() => {
          sync.mutate();
        }}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {sync.isPending ? t('checking') : t('checkNow')}
      </button>
      {sync.isError && (
        <span role="alert" className="text-red-700">
          {t('checkFailed', { error: errorText(sync.error) })}
        </span>
      )}
      {sync.data && (
        <span role="status" className="text-slate-600">
          {t('checked', { count: sync.data.suggestions })}
          {sync.data.warnings.map((warning) => (
            <span key={warning} className="block text-red-700">
              {warning}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
