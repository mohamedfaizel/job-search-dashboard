import type { Application } from '@jobsearch/data';

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
}

const CARDS: { key: StatCardKey; label: string; dot: string }[] = [
  { key: 'total', label: 'Jobs found', dot: 'bg-indigo-500' },
  { key: 'SAVED', label: 'Saved', dot: 'bg-sky-500' },
  { key: 'APPLIED', label: 'Applied', dot: 'bg-amber-500' },
  { key: 'INTERVIEWING', label: 'Interviewing', dot: 'bg-emerald-500' },
  { key: 'hidden', label: 'Hidden', dot: 'bg-slate-400' },
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
}: Props) {
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
      title="Jobs imported since your last visit"
      onClick={onToggleNew}
      className={pill(newOnly)}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-blue-500" />
      New
      <span className={`font-semibold tabular-nums ${newOnly ? 'text-white' : 'text-slate-900'}`}>
        {newCount}
      </span>
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Show jobs by status"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {CARDS.flatMap(({ key, label, dot }) => {
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
            {label}
            <span
              className={`font-semibold tabular-nums ${pressed ? 'text-white' : 'text-slate-900'}`}
            >
              {value(key) ?? '–'}
            </span>
          </button>
        );
        // The New chip sits right after "Jobs found": a part of them.
        return key === 'total' && newChip ? [card, newChip] : [card];
      })}
    </div>
  );
}
