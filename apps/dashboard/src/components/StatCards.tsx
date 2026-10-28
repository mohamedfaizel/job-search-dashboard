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
}

const CARDS: { key: StatCardKey; label: string; accent: string; ring: string }[] = [
  {
    key: 'total',
    label: 'Jobs found',
    accent: 'from-indigo-500 to-violet-500',
    ring: 'ring-indigo-500',
  },
  { key: 'SAVED', label: 'Saved', accent: 'from-sky-500 to-cyan-500', ring: 'ring-sky-500' },
  {
    key: 'APPLIED',
    label: 'Applied',
    accent: 'from-amber-500 to-orange-500',
    ring: 'ring-amber-500',
  },
  {
    key: 'INTERVIEWING',
    label: 'Interviewing',
    accent: 'from-emerald-500 to-teal-500',
    ring: 'ring-emerald-500',
  },
  { key: 'hidden', label: 'Hidden', accent: 'from-slate-400 to-slate-500', ring: 'ring-slate-500' },
];

/** A row of counts above the table. Each card is a button that shows its jobs in the table. */
export function StatCards({ total, applications, hiddenCount, active, onSelect }: Props) {
  const value = (key: StatCardKey) => {
    if (key === 'total') return total;
    if (key === 'hidden') return hiddenCount;
    return applications?.filter((a) => a.status === key).length;
  };

  return (
    <div
      role="group"
      aria-label="Show jobs by status"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    >
      {CARDS.map(({ key, label, accent, ring }) => {
        const pressed = active === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={pressed}
            onClick={() => {
              onSelect(key);
            }}
            className={`relative overflow-hidden rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none ${ring} ${
              pressed ? 'border-transparent ring-2' : 'border-slate-200'
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`}
            />
            <span className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              {label}
            </span>
            <span className="mt-1 block text-2xl font-semibold text-slate-900 tabular-nums">
              {value(key) ?? '–'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
