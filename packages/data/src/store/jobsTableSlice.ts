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
}

export const initialJobsTableState: JobsTableState = {
  search: '',
  filters: {},
  sort: null,
  page: 1,
  pageSize: 25,
  showHidden: false,
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
      state.page = 1;
    },
    /** Clicking a column header cycles: ascending → descending → off. */
    cycleSort(state, action: PayloadAction<JobSortField>) {
      const field = action.payload;
      if (state.sort?.field !== field) state.sort = { field, direction: 'ASC' };
      else if (state.sort.direction === 'ASC') state.sort = { field, direction: 'DESC' };
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
} = jobsTableSlice.actions;

/** Converts table state into the arguments for the jobsPage GraphQL query. */
export function toJobsPageArgs(state: JobsTableState): JobsPageArgs {
  const filter: JobFilterInput = {};
  const search = state.search.trim();
  if (search) filter.search = search;
  Object.assign(filter, state.filters);
  if (state.showHidden) filter.hidden = true;

  return {
    page: state.page,
    pageSize: state.pageSize,
    ...(Object.keys(filter).length ? { filter } : {}),
    ...(state.sort ? { sort: state.sort } : {}),
  };
}

export function countActiveFilters(state: JobsTableState): number {
  return Object.values(state.filters).reduce((sum, values) => sum + values.length, 0);
}
