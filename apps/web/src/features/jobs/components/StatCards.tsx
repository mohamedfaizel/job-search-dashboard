import type { Application } from '@jobsearch/data';
import { useTranslations } from 'next-intl';

export type StatCardKey = 'total' | 'SAVED' | 'APPLIED' | 'INTERVIEWING' | 'hidden';

interface Props {
  /** Jobs matching the current search and filters, whatever their status. */
  total: number | undefined;
  applications: Application[] | undefined;
  hiddenCount: number | undefined;
  /** The card whose jobs the table shows now, if any. */
  active: StatCardKey | null;
  onSelect: (key: StatCardKey) => void;
  /** Jobs imported since your last visit. The New chip shows only when there are some. */
  newCount?: number | undefined;
  /** True while the table shows only the New jobs. */
  newOnly?: boolean;
  onToggleNew?: (() => void) | undefined;
  /** Jobs in your Apply queue. The chip shows only when there are some. */
  queueCount?: number | undefined;
  /** True while the table shows only the jobs in your Apply queue. */
  queueOnly?: boolean;
  onToggleQueue?: (() => void) | undefined;
}

const CARDS: { key: StatCardKey; dot: string }[] = [
  { key: 'total', dot: 'bg-indigo-500' },
  { key: 'SAVED', dot: 'bg-sky-500' },
  { key: 'APPLIED', dot: 'bg-amber-500' },
  { key: 'INTERVIEWING', dot: 'bg-emerald-500' },
  { key: 'hidden', dot: 'bg-slate-400' },
];

/**
 * A slim strip of counts above the table, like tabs. Each one is a button that shows its jobs
 * in the table. On a phone the strip scrolls sideways instead of wrapping.
 */
export function StatCards({
  total,
  applications,
  hiddenCount,
  active,
  onSelect,
  newCount = 0,
  newOnly = false,
  onToggleNew,
  queueCount = 0,
  queueOnly = false,
  onToggleQueue,
}: Props) {
  const t = useTranslations('Jobs.cards');
  const value = (key: StatCardKey) => {
    if (key === 'total') return total;
    if (key === 'hidden') return hiddenCount;
    return applications?.filter((a) => a.status === key).length;
  };

  const pill = (pressed: boolean) =>
    `flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
      pressed
        ? 'border-slate-900 bg-slate-900 text-white'
        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
    }`;
  const newChip = onToggleNew && (newCount > 0 || newOnly) && (
    <button
      key="new"
      type="button"
      aria-pressed={newOnly}
      title={t('newHint')}
      onClick={onToggleNew}
      className={pill(newOnly)}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-blue-500" />
      {t('new')}
      <span className={`font-semibold tabular-nums ${newOnly ? 'text-white' : 'text-slate-900'}`}>
        {newCount}
      </span>
    </button>
  );

  const queueChip = onToggleQueue && (queueCount > 0 || queueOnly) && (
    <button
      key="queue"
      type="button"
      aria-pressed={queueOnly}
      title={t('queueHint')}
      onClick={onToggleQueue}
      className={pill(queueOnly)}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-violet-500" />
      {t('queue')}
      <span className={`font-semibold tabular-nums ${queueOnly ? 'text-white' : 'text-slate-900'}`}>
        {queueCount}
      </span>
    </button>
  );

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {CARDS.flatMap(({ key, dot }) => {
        const pressed = active === key;
        const card = (
          <button
            key={key}
            type="button"
            aria-pressed={pressed}
            onClick={() => {
              onSelect(key);
            }}
            className={pill(pressed)}
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
            {t(key)}
            <span
              className={`font-semibold tabular-nums ${pressed ? 'text-white' : 'text-slate-900'}`}
            >
              {value(key) ?? '–'}
            </span>
          </button>
        );
        // The New and Apply queue chips sit right after "Jobs found": parts of them.
        return key === 'total' ? [card, newChip, queueChip].filter(Boolean) : [card];
      })}
    </div>
  );
}
