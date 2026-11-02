import type { JobFilterOptions, JobsTableState, ListFilterKey } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { capitalize } from '../format';
import { useJobFormat } from '../useJobFormat';
import { ColumnFilter } from './ColumnFilter';

/** The "Posted" choices, in days. */
export const POSTED_WITHIN = [1, 3, 7, 30] as const;

interface Props {
  filters: JobsTableState['filters'];
  filterOptions: JobFilterOptions | undefined;
  postedWithinDays: number | null;
  minFit: number | null;
  onToggleFilter: (key: ListFilterKey, value: string) => void;
  onClearFilter: (key: ListFilterKey) => void;
  onPostedWithin: (days: number | null) => void;
  onMinFit: (minFit: number | null) => void;
}

/** The "Fit ≥ 70%" chip: a strong match, worth a closer look. */
export const GOOD_FIT = 70;

/**
 * The filters you reach for most, as chips above the table: they work on phones too, where the
 * column headers are gone. They change the same filters as the column headers.
 */
export function QuickFilters({
  filters,
  filterOptions,
  postedWithinDays,
  minFit,
  onToggleFilter,
  onClearFilter,
  onPostedWithin,
  onMinFit,
}: Props) {
  const t = useTranslations('Jobs.quick');
  const f = useJobFormat();
  const goodFit = minFit === GOOD_FIT;
  const remote = filters.workplaces?.includes('REMOTE') ?? false;
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${
      on
        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
    }`;

  return (
    <div role="group" aria-label={t('label')} className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={goodFit}
        onClick={() => {
          onMinFit(goodFit ? null : GOOD_FIT);
        }}
        className={chip(goodFit)}
      >
        {t('goodFit', { fit: GOOD_FIT })}
      </button>
      <ColumnFilter
        chip
        column={t('country')}
        options={(filterOptions?.countryCodes ?? []).map((code) => ({
          value: code,
          label: f.country(code),
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
        {t('remote')}
      </button>
      <ColumnFilter
        chip
        column={t('seniority')}
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
        aria-label={t('posted')}
        value={postedWithinDays ?? ''}
        onChange={(e) => {
          onPostedWithin(e.target.value ? Number(e.target.value) : null);
        }}
        className={`${chip(postedWithinDays !== null)} appearance-none pr-3`}
      >
        <option value="">{t('anyTime')}</option>
        {POSTED_WITHIN.map((days) => (
          <option key={days} value={days}>
            {t(`within.d${days}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
