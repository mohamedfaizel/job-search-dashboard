import { getErrorMessage } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const BUTTON =
  'rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60';

interface Run {
  status: 'PENDING' | 'READY' | 'FAILED';
  error: string | null;
}

interface Props<T extends Run> {
  /** Its texts: title, again, loading, pending, start, startHint, failed and tryAgain. */
  namespace: 'Jobs.match' | 'Jobs.tailor';
  /** The heading's id, for the section's name. */
  titleId: string;
  /** True while the saved run is still loading. */
  loading: boolean;
  /** The last run, or null when there is none yet. */
  data: T | null | undefined;
  start: { isPending: boolean; isError: boolean; error: unknown; mutate: () => void };
  /** What a finished run shows. */
  children: (data: T) => ReactNode;
}

/**
 * One Resume-Matcher job in the popup (a match or a tailoring): a button to start it, progress
 * while it runs (minutes), the error when it fails, and the result once it is ready.
 */
export function AiRunSection<T extends Run>({
  namespace,
  titleId,
  loading,
  data,
  start,
  children,
}: Props<T>) {
  const t = useTranslations(namespace);
  const pending = start.isPending || data?.status === 'PENDING';

  const startButton = (label: string) => (
    <button type="button" disabled={pending} onClick={start.mutate} className={BUTTON}>
      {label}
    </button>
  );

  return (
    <section aria-labelledby={titleId} className="space-y-3 border-b border-slate-200 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={titleId} className="text-sm font-semibold text-slate-900">
          {t('title')}
        </h3>
        {data?.status === 'READY' && startButton(t('again'))}
      </div>

      {/* aria-live announces the progress and the result to screen readers. */}
      <div aria-live="polite" className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">{t('loading')}</p>
        ) : pending ? (
          <p className="text-sm text-slate-700">{t('pending')}</p>
        ) : !data ? (
          <div className="flex flex-wrap items-center gap-3">
            {startButton(t('start'))}
            <span className="text-xs text-slate-500">{t('startHint')}</span>
          </div>
        ) : data.status === 'FAILED' ? (
          <div className="space-y-2">
            <p className="text-sm text-red-700">{data.error ?? t('failed')}</p>
            {startButton(t('tryAgain'))}
          </div>
        ) : (
          children(data)
        )}
        {start.isError && (
          <p role="alert" className="text-sm text-red-700">
            {getErrorMessage(start.error)}
          </p>
        )}
      </div>
    </section>
  );
}
