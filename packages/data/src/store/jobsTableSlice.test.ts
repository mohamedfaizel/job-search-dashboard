import {
  clearAll,
  countActiveFilters,
  cycleSort,
  initialJobsTableState,
  jobsTableSlice,
  setPage,
  setSearch,
  toggleFilterValue,
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

  it('cycles sorting ascending, descending, then off', () => {
    let state = reduce(initialJobsTableState, cycleSort('SALARY'));
    expect(state.sort).toEqual({ field: 'SALARY', direction: 'ASC' });
    state = reduce(state, cycleSort('SALARY'));
    expect(state.sort).toEqual({ field: 'SALARY', direction: 'DESC' });
    state = reduce(state, cycleSort('SALARY'));
    expect(state.sort).toBeNull();
  });

  it('goes back to page 1 when the filters change', () => {
    let state = reduce(initialJobsTableState, setPage(3));
    state = reduce(state, setSearch('react'));
    expect(state.page).toBe(1);
  });

  it('builds query arguments, leaving out empty parts', () => {
    expect(toJobsPageArgs(initialJobsTableState)).toEqual({ page: 1, pageSize: 25 });

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

  it('counts active filter values and clears them all', () => {
    let state = reduce(
      initialJobsTableState,
      toggleFilterValue({ key: 'cities', value: 'Berlin' }),
    );
    state = reduce(state, toggleFilterValue({ key: 'skills', value: 'react' }));
    expect(countActiveFilters(state)).toBe(2);
    expect(reduce(state, clearAll()).filters).toEqual({});
  });
});
