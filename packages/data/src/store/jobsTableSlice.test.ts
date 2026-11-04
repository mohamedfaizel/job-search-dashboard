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
  setNewOnly,
  setNewSince,
  setShowHidden,
  toJobsPageArgs,
  parseSavedSettings,
  toSavedSettings,
  applySavedSettings,
  setColumnChoices,
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

  it('opens sorted by Posted, newest first, and cycles Posted and Fit descending first', () => {
    expect(initialJobsTableState.sort).toEqual({ field: 'POSTED_AT', direction: 'DESC' });
    let state = reduce(initialJobsTableState, cycleSort('POSTED_AT'));
    expect(state.sort).toEqual({ field: 'POSTED_AT', direction: 'ASC' });
    state = reduce(state, cycleSort('POSTED_AT'));
    expect(state.sort).toBeNull();
    state = reduce(state, cycleSort('FIT'));
    expect(state.sort).toEqual({ field: 'FIT', direction: 'DESC' });
    state = reduce(state, cycleSort('FIT'));
    expect(state.sort).toEqual({ field: 'FIT', direction: 'ASC' });
  });

  it('leaves out expired postings, and jobs you applied to unless a status is picked', () => {
    expect(toJobsPageArgs(initialJobsTableState).filter).toEqual({
      hideExpired: true,
      hideApplied: true,
    });
    const applied = reduce(
      initialJobsTableState,
      toggleFilterValue({ key: 'applicationStatuses', value: 'APPLIED' }),
    );
    expect(toJobsPageArgs(applied).filter).toEqual({
      applicationStatuses: ['APPLIED'],
      hideExpired: true,
    });
  });

  it('asks for a minimum Fit, counted as a filter', () => {
    const state = reduce(initialJobsTableState, setMinFit(70));
    expect(toJobsPageArgs(state).filter).toMatchObject({ minFit: 70 });
    expect(countActiveFilters(state)).toBe(1);
    expect(reduce(state, clearAll()).minFit).toBeNull();
  });

  it('asks for the New jobs only once the visit time is known', () => {
    let state = reduce(initialJobsTableState, setNewOnly(true));
    expect(toJobsPageArgs(state).filter).not.toHaveProperty('createdAfter');

    state = reduce(state, setNewSince('2026-10-30T09:00:00.000Z'));
    expect(toJobsPageArgs(state).filter).toMatchObject({
      createdAfter: '2026-10-30T09:00:00.000Z',
    });
    expect(countActiveFilters(state)).toBe(1);
    state = reduce(state, clearAll());
    expect(state.newOnly).toBe(false);
    // The visit time stays: it isn't a filter you chose.
    expect(state.newSince).toBe('2026-10-30T09:00:00.000Z');
  });

  describe('saved settings', () => {
    it('saves filters, sort and column choices, and reads them back', () => {
      let state = reduce(
        initialJobsTableState,
        toggleFilterValue({ key: 'workplaces', value: 'REMOTE' }),
      );
      state = reduce(state, setMinFit(70));
      state = reduce(state, cycleSort('SALARY'));
      state = reduce(state, setColumnChoices({ salary: false }));

      const back = parseSavedSettings(toSavedSettings(state));
      expect(back).toEqual({
        filters: { workplaces: ['REMOTE'] },
        sort: { field: 'SALARY', direction: 'ASC' },
        postedWithinDays: null,
        minFit: 70,
        pageSize: 25,
        columns: { salary: false },
      });
      const restored = reduce(initialJobsTableState, applySavedSettings(back));
      expect(restored).toMatchObject({ ...back, restored: true, page: 1 });
    });

    it('is restored even when nothing was saved', () => {
      const state = reduce(initialJobsTableState, applySavedSettings(null));
      expect(state.restored).toBe(true);
      expect(state.sort).toEqual(initialJobsTableState.sort);
    });

    it('keeps "no sort" as no sort', () => {
      const off = reduce(initialJobsTableState, cycleSort('POSTED_AT'));
      const state = reduce(off, cycleSort('POSTED_AT'));
      expect(state.sort).toBeNull();
      expect(parseSavedSettings(toSavedSettings(state))?.sort).toBeNull();
    });

    it('drops what is not valid and keeps the rest', () => {
      const back = parseSavedSettings(
        JSON.stringify({
          filters: { workplaces: ['REMOTE', 3], nope: ['x'], cities: 'Berlin' },
          sort: { field: 'NOPE', direction: 'UP' },
          postedWithinDays: -2,
          minFit: 500,
          pageSize: 'big',
          columns: { salary: false, match: 'yes' },
        }),
      );
      expect(back).toEqual({
        filters: { workplaces: ['REMOTE'] },
        sort: initialJobsTableState.sort,
        postedWithinDays: null,
        minFit: null,
        pageSize: 25,
        columns: { salary: false },
      });
    });

    it('gives nothing for text that is not a saved table', () => {
      expect(parseSavedSettings(null)).toBeNull();
      expect(parseSavedSettings('')).toBeNull();
      expect(parseSavedSettings('not json')).toBeNull();
      expect(parseSavedSettings('[1]')).toBeNull();
      expect(parseSavedSettings('{}')).toMatchObject({ filters: {}, columns: {} });
    });
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
      filter: { hideExpired: true, hideApplied: true },
      sort: { field: 'POSTED_AT', direction: 'DESC' },
    });

    let state = reduce(initialJobsTableState, setSearch('  frontend '));
    state = reduce(state, toggleFilterValue({ key: 'workplaces', value: 'REMOTE' }));
    state = reduce(state, cycleSort('POSTED_AT'));
    expect(toJobsPageArgs(state)).toEqual({
      page: 1,
      pageSize: 25,
      filter: {
        search: 'frontend',
        workplaces: ['REMOTE'],
        hideExpired: true,
        hideApplied: true,
      },
      sort: { field: 'POSTED_AT', direction: 'ASC' },
    });
  });

  it('asks for only the hidden jobs while they are shown, from page 1', () => {
    let state = reduce(initialJobsTableState, setPage(3));
    state = reduce(state, setShowHidden(true));

    expect(toJobsPageArgs(state)).toMatchObject({ page: 1, filter: { hidden: true } });
    expect(toJobsPageArgs(reduce(state, setShowHidden(false))).filter).not.toHaveProperty('hidden');
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
      expect(toJobsPageArgs(state).filter).toMatchObject({
        postedAfter: '2026-10-26T10:00:00.000Z',
      });
      expect(countActiveFilters(state)).toBe(1);
      expect(reduce(state, clearAll()).postedWithinDays).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
