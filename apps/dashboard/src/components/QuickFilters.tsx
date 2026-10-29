import type { JobFilterOptions, JobsTableState, ListFilterKey } from '@jobsearch/data';
import { capitalize, countryName } from '../format';
import { ColumnFilter } from './ColumnFilter';

/** The "Posted" choices, in days. */
export const POSTED_WITHIN = [
  { days: 1, label: 'Last 24 hours' },
  { days: 3, label: 'Last 3 days' },
  { days: 7, label: 'Last week' },
  { days: 30, label: 'Last month' },
] as const;

interface Props {
  filters: JobsTableState['filters'];
  filterOptions: JobFilterOptions | undefined;
  postedWithinDays: number | null;
  onToggleFilter: (key: ListFilterKey, value: string) => void;
  onClearFilter: (key: ListFilterKey) => void;
  onPostedWithin: (days: number | null) => void;
}

/**
 * The filters you reach for most, as chips above the table: they work on phones too, where the
 * column headers are gone. They change the same filters as the column headers.
 */
export function QuickFilters({
  filters,
  filterOptions,
  postedWithinDays,
  onToggleFilter,
  onClearFilter,
  onPostedWithin,
}: Props) {
  const remote = filters.workplaces?.includes('REMOTE') ?? false;
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${
      on
        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
    }`;

  return (
    <div role="group" aria-label="Quick filters" className="flex flex-wrap items-center gap-2">
      <ColumnFilter
        chip
        column="Country"
        options={(filterOptions?.countryCodes ?? []).map((code) => ({
          value: code,
          label: countryName(code),
        }))}
        selected={filters.countryCodes ?? []}
        onToggle={(value) => {
          onToggleFilter('countryCodes', value);
        }}
        onClear={() => {
          onClearFilter('countryCodes');
        }}
      />
      <button
        type="button"
        aria-pressed={remote}
        onClick={() => {
          onToggleFilter('workplaces', 'REMOTE');
        }}
        className={chip(remote)}
      >
        Remote
      </button>
      <ColumnFilter
        chip
        column="Seniority"
        options={(filterOptions?.seniorities ?? []).map((v) => ({
          value: v,
          label: capitalize(v),
        }))}
        selected={filters.seniorities ?? []}
        onToggle={(value) => {
          onToggleFilter('seniorities', value);
        }}
        onClear={() => {
          onClearFilter('seniorities');
        }}
      />
      <select
        aria-label="Posted"
        value={postedWithinDays ?? ''}
        onChange={(e) => {
          onPostedWithin(e.target.value ? Number(e.target.value) : null);
        }}
        className={`${chip(postedWithinDays !== null)} appearance-none pr-3`}
      >
        <option value="">Posted: any time</option>
        {POSTED_WITHIN.map(({ days, label }) => (
          <option key={days} value={days}>
            Posted: {label.toLowerCase()}
          </option>
        ))}
      </select>
    </div>
  );
}
