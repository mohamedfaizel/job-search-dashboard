import {
  clearAll,
  countActiveFilters,
  cycleSort,
  initialJobsTableState,
  jobsTableSlice,
  setPage,
  setFilterValues,
  setSearch,
  toggleFilterValue,
  setPostedWithinDays,
  setMinFit,
  setShowHidden,
  toJobsPageArgs,
} from './jobsTableSlice';

const reduce = jobsTableSlice.reducer;

describe('jobsTable slice', () => {
  it('toggles filter values on and off', () => {
    let state = reduce(initialJobsTableState, toggleFilterValue({ key: 'skills', value: 'react' }));
    state = reduce(state, toggleFilterValue({ key: 'skills', value: 'node' }));
    expect(state.filters.skills).toEqual(['react', 'node']);

    state = reduce(state, toggleFilterValue({ key: 'skills', value: 'react' }));
    state = reduce(state, toggleFilterValue({ key: 'skills', value: 'node' }));
    expect(state.filters).toEqual({});
  });

  it('replaces a filter in one go, and removes it when empty', () => {
    let state = reduce(initialJobsTableState, setPage(3));
    state = reduce(state, setFilterValues({ key: 'applicationStatuses', values: ['SAVED'] }));
    expect(state.filters.applicationStatuses).toEqual(['SAVED']);
    expect(state.page).toBe(1);

    state = reduce(state, setFilterValues({ key: 'applicationStatuses', values: [] }));
    expect(state.filters).toEqual({});
  });

  it('cycles sorting ascending, descending, then off', () => {
    let state = reduce(initialJobsTableState, cycleSort('SALARY'));
    expect(state.sort).toEqual({ field: 'SALARY', direction: 'ASC' });
    state = reduce(state, cycleSort('SALARY'));
    expect(state.sort).toEqual({ field: 'SALARY', direction: 'DESC' });
    state = reduce(state, cycleSort('SALARY'));
    expect(state.sort).toBeNull();
  });

  it('opens sorted by Fit, best first, and cycles Fit descending first', () => {
    expect(initialJobsTableState.sort).toEqual({ field: 'FIT', direction: 'DESC' });
    let state = reduce(initialJobsTableState, cycleSort('FIT'));
    expect(state.sort).toEqual({ field: 'FIT', direction: 'ASC' });
    state = reduce(state, cycleSort('FIT'));
    expect(state.sort).toBeNull();
    state = reduce(state, cycleSort('FIT'));
    expect(state.sort).toEqual({ field: 'FIT', direction: 'DESC' });
  });

  it('asks for a minimum Fit, counted as a filter', () => {
    const state = reduce(initialJobsTableState, setMinFit(70));
    expect(toJobsPageArgs(state).filter).toEqual({ minFit: 70 });
    expect(countActiveFilters(state)).toBe(1);
    expect(reduce(state, clearAll()).minFit).toBeNull();
  });

  it('goes back to page 1 when the filters change', () => {
    let state = reduce(initialJobsTableState, setPage(3));
    state = reduce(state, setSearch('react'));
    expect(state.page).toBe(1);
  });

  it('builds query arguments, leaving out empty parts', () => {
    expect(toJobsPageArgs(initialJobsTableState)).toEqual({
      page: 1,
      pageSize: 25,
      sort: { field: 'FIT', direction: 'DESC' },
    });

    let state = reduce(initialJobsTableState, setSearch('  frontend '));
    state = reduce(state, toggleFilterValue({ key: 'workplaces', value: 'REMOTE' }));
    state = reduce(state, cycleSort('POSTED_AT'));
    expect(toJobsPageArgs(state)).toEqual({
      page: 1,
      pageSize: 25,
      filter: { search: 'frontend', workplaces: ['REMOTE'] },
      sort: { field: 'POSTED_AT', direction: 'ASC' },
    });
  });

  it('asks for only the hidden jobs while they are shown, from page 1', () => {
    let state = reduce(initialJobsTableState, setPage(3));
    state = reduce(state, setShowHidden(true));

    expect(toJobsPageArgs(state)).toMatchObject({ page: 1, filter: { hidden: true } });
    expect(toJobsPageArgs(reduce(state, setShowHidden(false))).filter).toBeUndefined();
  });

  it('counts active filter values and clears them all', () => {
    let state = reduce(
      initialJobsTableState,
      toggleFilterValue({ key: 'cities', value: 'Berlin' }),
    );
    state = reduce(state, toggleFilterValue({ key: 'skills', value: 'react' }));
    expect(countActiveFilters(state)).toBe(2);
    expect(reduce(state, clearAll()).filters).toEqual({});
  });

  it('asks for jobs posted in the last few days, counted from the start of the hour', () => {
    vi.useFakeTimers({ now: new Date('2026-10-29T10:42:00.000Z') });
    try {
      const state = reduce(initialJobsTableState, setPostedWithinDays(3));
      expect(toJobsPageArgs(state).filter).toEqual({ postedAfter: '2026-10-26T10:00:00.000Z' });
      expect(countActiveFilters(state)).toBe(1);
      expect(reduce(state, clearAll()).postedWithinDays).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
