import type { Job } from '@jobsearch/data';
import { useCheckJobStillOpen } from '@jobsearch/data';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

/** Opening the Apply tab checks again when the last check is older than this. */
const AUTO_CHECK_AFTER_MS = 6 * 60 * 60 * 1000;

const REASONS = [
  'LOOKS_OPEN',
  'NOT_FOUND',
  'SAYS_CLOSED',
  'REDIRECTED',
  'BLOCKED',
  'SERVER_ERROR',
  'NO_CONTENT',
  'TIMEOUT',
  'UNREACHABLE',
  'NO_LINK',
] as const;
type Reason = (typeof REASONS)[number];
const isReason = (code: string | null): code is Reason => REASONS.includes((code ?? '') as Reason);

/** Closed by JobsPipe, or found closed by our still-open check. */
export function isExpired(job: Pick<Job, 'postingStatus'>): boolean {
  return job.postingStatus === 'expired' || job.postingStatus === 'closed';
}

const TONE = {
  open: 'bg-emerald-500',
  expired: 'bg-red-500',
  unsure: 'bg-amber-500',
  never: 'bg-slate-300',
} as const;

/**
 * "Still open? Checked 2 h ago · Check now" in the job popup. With `autoCheck` (the Apply tab is
 * open) it checks by itself when the last check is old, so you don't write a letter for a
 * closed job.
 */
export function StillOpen({ job, autoCheck = false }: { job: Job; autoCheck?: boolean }) {
  const t = useTranslations('Jobs.stillOpen');
  const format = useFormatter();
  const errorText = useErrorText();
  const check = useCheckJobStillOpen();
  const autoChecked = useRef(false);
  const expired = isExpired(job);

  const { mutate } = check;
  useEffect(() => {
    if (!autoCheck || autoChecked.current || !job.url || expired) return;
    const age = job.checkedAt ? Date.now() - Date.parse(job.checkedAt) : Infinity;
    if (age < AUTO_CHECK_AFTER_MS) return;
    autoChecked.current = true;
    mutate(job.id);
  }, [autoCheck, expired, job.checkedAt, job.id, job.url, mutate]);

  const reason = isReason(job.checkReason) ? t(`reasons.${job.checkReason}`) : null;
  const when = job.checkedAt ? format.relativeTime(new Date(job.checkedAt), new Date()) : null;

  let tone: keyof typeof TONE = 'never';
  let text: string = t('never');
  if (expired) {
    tone = 'expired';
    text = reason && job.lastCheck === 'CLOSED' ? t('expiredBecause', { reason }) : t('expired');
  } else if (job.lastCheck === 'OPEN') {
    tone = 'open';
    text = t('open', { when: when ?? '' });
  } else if (job.lastCheck === 'UNKNOWN') {
    tone = 'unsure';
    text = reason ? t('unsure', { reason }) : t('unsureNoReason');
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-live="polite">
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${TONE[tone]}`} />
      <span className={expired ? 'font-medium text-red-700' : 'text-slate-600'}>
        {check.isPending ? t('checking') : text}
      </span>
      {when && !check.isPending && tone !== 'open' && (
        <span className="text-slate-500">· {t('checkedWhen', { when })}</span>
      )}
      {job.url && (
        <button
          type="button"
          onClick={() => {
            check.mutate(job.id);
          }}
          disabled={check.isPending}
          className="font-medium text-brand-700 hover:underline disabled:opacity-60"
        >
          {t('checkNow')}
        </button>
      )}
      {check.isError && (
        <span role="alert" className="text-red-700">
          {t('failed', { error: errorText(check.error) })}
        </span>
      )}
    </div>
  );
}
