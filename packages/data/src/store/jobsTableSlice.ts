import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { JobFilterInput, JobSortField, JobSortInput, JobsPageArgs } from '../api/types';

/** The filters that hold a list of values (one per column filter). */
export type ListFilterKey = {
  [K in keyof JobFilterInput]-?: NonNullable<JobFilterInput[K]> extends string[] ? K : never;
}[keyof JobFilterInput];

/**
 * What the user has chosen in the table: search, column filters, sort and page.
 * It lives in Redux so any microfrontend (and the URL, later) can read or change it.
 */
export interface JobsTableState {
  search: string;
  filters: Partial<Record<ListFilterKey, string[]>>;
  sort: JobSortInput | null;
  page: number;
  pageSize: number;
  /** Show only the jobs you hid, instead of leaving them out. */
  showHidden: boolean;
  /** Only jobs posted in the last this-many days ("Posted" quick filter); null for any time. */
  postedWithinDays: number | null;
  /** Only jobs with at least this Fit % ("Fit ≥ 70%" quick filter); null for any. */
  minFit: number | null;
  /** Jobs imported after this are New on this visit; null on a first visit or while loading. */
  newSince: string | null;
  /** Show only the New jobs (the New chip). */
  newOnly: boolean;
}

/** The table opens with your best matches first. */
export const DEFAULT_SORT: JobSortInput = { field: 'FIT', direction: 'DESC' };

export const initialJobsTableState: JobsTableState = {
  search: '',
  filters: {},
  sort: DEFAULT_SORT,
  page: 1,
  pageSize: 25,
  showHidden: false,
  postedWithinDays: null,
  minFit: null,
  newSince: null,
  newOnly: false,
};

export const jobsTableSlice = createSlice({
  name: 'jobsTable',
  initialState: initialJobsTableState,
  reducers: {
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
    },
    toggleFilterValue(state, action: PayloadAction<{ key: ListFilterKey; value: string }>) {
      const { key, value } = action.payload;
      const current = state.filters[key] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (next.length) state.filters[key] = next;
      else Reflect.deleteProperty(state.filters, key);
      state.page = 1;
    },
    /** Replaces a filter's values in one go, e.g. when a dashboard card picks a status. */
    setFilterValues(state, action: PayloadAction<{ key: ListFilterKey; values: string[] }>) {
      const { key, values } = action.payload;
      if (values.length) state.filters[key] = values;
      else Reflect.deleteProperty(state.filters, key);
      state.page = 1;
    },
    clearFilter(state, action: PayloadAction<ListFilterKey>) {
      Reflect.deleteProperty(state.filters, action.payload);
      state.page = 1;
    },
    clearAll(state) {
      state.search = '';
      state.filters = {};
      state.postedWithinDays = null;
      state.minFit = null;
      state.newOnly = false;
      state.page = 1;
    },
    setPostedWithinDays(state, action: PayloadAction<number | null>) {
      state.postedWithinDays = action.payload;
      state.page = 1;
    },
    setNewSince(state, action: PayloadAction<string | null>) {
      state.newSince = action.payload;
    },
    setNewOnly(state, action: PayloadAction<boolean>) {
      state.newOnly = action.payload;
      state.page = 1;
    },
    setMinFit(state, action: PayloadAction<number | null>) {
      state.minFit = action.payload;
      state.page = 1;
    },
    /**
     * Clicking a column header cycles: ascending → descending → off. Fit starts with descending,
     * because the best match first is what you want from it.
     */
    cycleSort(state, action: PayloadAction<JobSortField>) {
      const field = action.payload;
      const [first, second] =
        field === 'FIT' ? (['DESC', 'ASC'] as const) : (['ASC', 'DESC'] as const);
      if (state.sort?.field !== field) state.sort = { field, direction: first };
      else if (state.sort.direction === first) state.sort = { field, direction: second };
      else state.sort = null;
      state.page = 1;
    },
    setShowHidden(state, action: PayloadAction<boolean>) {
      state.showHidden = action.payload;
      state.page = 1;
    },
    setPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
    },
    setPageSize(state, action: PayloadAction<number>) {
      state.pageSize = action.payload;
      state.page = 1;
    },
  },
});

export const {
  setSearch,
  toggleFilterValue,
  setFilterValues,
  clearFilter,
  clearAll,
  cycleSort,
  setPage,
  setPageSize,
  setShowHidden,
  setPostedWithinDays,
  setMinFit,
  setNewSince,
  setNewOnly,
} = jobsTableSlice.actions;

const HOUR_MS = 60 * 60 * 1000;

/** Converts table state into the arguments for the jobsPage GraphQL query. */
export function toJobsPageArgs(state: JobsTableState): JobsPageArgs {
  const filter: JobFilterInput = {};
  const search = state.search.trim();
  if (search) filter.search = search;
  Object.assign(filter, state.filters);
  if (state.showHidden) filter.hidden = true;
  if (state.minFit !== null) filter.minFit = state.minFit;
  if (state.newOnly && state.newSince) filter.createdAfter = state.newSince;
  if (state.postedWithinDays !== null) {
    // Counted from the start of this hour, so the query (and its cache entry) stays the same
    // for an hour instead of changing every millisecond.
    const hour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
    filter.postedAfter = new Date(hour - state.postedWithinDays * 24 * HOUR_MS).toISOString();
  }

  return {
    page: state.page,
    pageSize: state.pageSize,
    ...(Object.keys(filter).length ? { filter } : {}),
    ...(state.sort ? { sort: state.sort } : {}),
  };
}

export function countActiveFilters(state: JobsTableState): number {
  const listed = Object.values(state.filters).reduce((sum, values) => sum + values.length, 0);
  const others = [state.postedWithinDays !== null, state.minFit !== null, state.newOnly];
  return listed + others.filter(Boolean).length;
}
