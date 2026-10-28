import type { Application } from '@jobsearch/data';

interface Props {
  /** Jobs matching the current search and filters. */
  total: number | undefined;
  applications: Application[] | undefined;
  hiddenCount: number | undefined;
}

const CARDS = [
  { key: 'total', label: 'Jobs found', accent: 'from-indigo-500 to-violet-500' },
  { key: 'SAVED', label: 'Saved', accent: 'from-sky-500 to-cyan-500' },
  { key: 'APPLIED', label: 'Applied', accent: 'from-amber-500 to-orange-500' },
  { key: 'INTERVIEWING', label: 'Interviewing', accent: 'from-emerald-500 to-teal-500' },
  { key: 'hidden', label: 'Hidden', accent: 'from-slate-400 to-slate-500' },
] as const;

/** A row of counts above the table: what you found and where you are with it. */
export function StatCards({ total, applications, hiddenCount }: Props) {
  const value = (key: (typeof CARDS)[number]['key']) => {
    if (key === 'total') return total;
    if (key === 'hidden') return hiddenCount;
    return applications?.filter((a) => a.status === key).length;
  };

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map(({ key, label, accent }) => (
        <div
          key={key}
          className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <span
            aria-hidden="true"
            className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`}
          />
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
            {value(key) ?? '–'}
          </dd>
        </div>
      ))}
    </dl>
  );
}
