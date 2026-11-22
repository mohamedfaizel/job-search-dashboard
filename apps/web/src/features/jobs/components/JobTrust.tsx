import type { Job, JobTrustLevel } from '@jobsearch/data';
import { useJobTrust } from '@jobsearch/data';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { COMPACT_CHIP } from './StillOpen';

const DOT: Record<JobTrustLevel, string> = {
  OK: 'bg-emerald-500',
  CAUTION: 'bg-amber-500',
  WARNING: 'bg-red-500',
};

/**
 * "Is this job real?" in the job popup: one line under "Still open?". Green when the ad shows no
 * warning signs; amber with a list to open when something is worth a look; red, list open, when
 * the ad looks like a scam (asks for money, bank details, or chat-app-only contact).
 */
export function JobTrust({
  job,
  compact = false,
}: {
  job: Pick<Job, 'id'>;
  /** A small chip for the phone header; tap it to open the list under the chip row. */
  compact?: boolean;
}) {
  const t = useTranslations('Jobs.trust');
  const format = useFormatter();
  const listId = useId();
  const { data } = useJobTrust(job.id);
  const [open, setOpen] = useState<boolean | null>(null);
  if (!data) return null;

  const showList = data.flags.length > 0 && (open ?? data.level === 'WARNING');
  let text = t('ok');
  if (data.level === 'WARNING') text = t('warning');
  else if (data.level === 'CAUTION') text = t('caution', { count: data.flags.length });

  const list = showList && (
    <ul
      id={listId}
      className={`list-disc space-y-0.5 text-slate-700 ${compact ? 'ml-5 basis-full text-sm' : 'mt-1 ml-4'}`}
    >
      {data.flags.map((flag) => (
        <li key={flag}>
          {t(`flags.${flag}`, {
            count: data.reposts,
            date: data.firstPostedAt
              ? format.dateTime(new Date(data.firstPostedAt), { dateStyle: 'medium' })
              : '',
            days: data.ageDays,
          })}
        </li>
      ))}
    </ul>
  );

  if (compact) {
    const short = t(
      `short.${data.level === 'OK' ? 'ok' : data.level === 'WARNING' ? 'warning' : 'caution'}`,
      {
        count: data.flags.length,
      },
    );
    const chip = (
      <>
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[data.level]}`} />
        <span className={data.level === 'WARNING' ? 'font-medium text-red-700' : undefined}>
          {short}
        </span>
        <span className="sr-only">{`: ${text}`}</span>
      </>
    );
    return (
      <>
        {data.flags.length > 0 ? (
          <button
            type="button"
            aria-expanded={showList}
            aria-controls={listId}
            onClick={() => {
              setOpen(!showList);
            }}
            title={t('hint')}
            className={COMPACT_CHIP}
          >
            {chip}
          </button>
        ) : (
          <span title={t('hint')} className={COMPACT_CHIP}>
            {chip}
          </span>
        )}
        {list}
      </>
    );
  }

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[data.level]}`} />
        <span
          title={t('hint')}
          className={data.level === 'WARNING' ? 'font-medium text-red-700' : 'text-slate-600'}
        >
          {text}
        </span>
        {data.flags.length > 0 && (
          <button
            type="button"
            aria-expanded={showList}
            aria-controls={listId}
            onClick={() => {
              setOpen(!showList);
            }}
            className="font-medium text-brand-700 hover:underline"
          >
            {showList ? t('hide') : t('show')}
          </button>
        )}
      </div>
      {list}
    </div>
  );
}
