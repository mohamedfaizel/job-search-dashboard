import type { ApplicationStatus, Job, JobSortField, ListFilterKey } from '@jobsearch/data';
import {
  clearAll,
  clearFilter,
  countActiveFilters,
  cycleSort,
  getErrorMessage,
  setPage,
  setPageSize,
  setFilterValues,
  setMinFit,
  setNewOnly,
  setNewSince,
  setPostedWithinDays,
  setSearch,
  setShowHidden,
  toggleFilterValue,
  toJobsPageArgs,
  useAppDispatch,
  useAppSelector,
  useChangeApplyQueue,
  useRecalculateFit,
  useJobFilterOptions,
  useHiddenJobCount,
  useJob,
  useJobsPage,
  useJobsVisit,
  useMyApplications,
  useSetJobHidden,
  useUpdateJobStatus,
} from '@jobsearch/data';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApplyQueuePanel } from './components/ApplyQueuePanel';
import { columns, DEFAULT_HIDDEN_COLUMNS } from './components/columns';
import { ColumnsMenu } from './components/ColumnsMenu';
import { JobDetailsDialog } from './components/JobDetailsDialog';
import { JobsTable } from './components/JobsTable';
import { Pagination } from './components/Pagination';
import { QuickFilters } from './components/QuickFilters';
import type { StatCardKey } from './components/StatCards';
import { StatCards } from './components/StatCards';
import { Toolbar } from './components/Toolbar';
import { useColumnVisibility } from './useColumnVisibility';
import { usePendingApplies } from './usePendingApplies';

const NO_JOBS: Job[] = [];
const STATUS_CARDS: StatCardKey[] = ['SAVED', 'APPLIED', 'INTERVIEWING'];

/** Every column for the Columns menu, in table order. The tick boxes and the action icons
 * have no name as a header (theirs is a component), and always show, so they aren't listed. */
const COLUMN_CHOICES = columns
  .filter((column) => typeof column.header === 'string')
  .map((column) => ({
    // Accessor columns take their id from the field they read.
    id: column.id ?? ('accessorKey' in column ? String(column.accessorKey) : ''),
    label: String(column.header),
    canHide: column.enableHiding !== false,
  }));

const ERROR_BOX = 'rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800';

/** Connects the table to Redux (what the user chose) and TanStack Query (the data). */
export function JobsDashboard() {
  const dispatch = useAppDispatch();
  const tableState = useAppSelector((state) => state.jobsTable);
  const args = useMemo(() => toJobsPageArgs(tableState), [tableState]);

  const jobsQuery = useJobsPage(args);
  const filterOptions = useJobFilterOptions();
  const updateStatus = useUpdateJobStatus();
  const setHidden = useSetJobHidden();
  const changeQueue = useChangeApplyQueue();
  const recalculateFit = useRecalculateFit();
  const hiddenCount = useHiddenJobCount();
  const applications = useMyApplications();
  const columnVisibility = useColumnVisibility(DEFAULT_HIDDEN_COLUMNS);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  // The last jobs hidden or brought back, for the "Undo" message.
  const [lastChange, setLastChange] = useState<{ jobs: Job[]; hidden: boolean } | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const applying = usePendingApplies();
  const askingIds = useMemo(() => new Set(applying.pending.map((p) => p.id)), [applying.pending]);
  const showingHidden = tableState.showHidden;

  // "Jobs found" counts your search and column filters, whatever the status card picked.
  const foundArgs = useMemo(() => {
    const filters = { ...tableState.filters };
    Reflect.deleteProperty(filters, 'applicationStatuses');
    return toJobsPageArgs({
      ...tableState,
      filters,
      showHidden: false,
      sort: null,
      page: 1,
      pageSize: 1,
    });
  }, [tableState]);
  const foundQuery = useJobsPage(foundArgs);

  // Opening Job posts starts a visit; jobs imported since the last one are New.
  const visit = useJobsVisit();
  const newSince = tableState.newSince;
  useEffect(() => {
    if (visit.isSuccess) dispatch(setNewSince(visit.data));
  }, [visit.isSuccess, visit.data, dispatch]);
  // How many New jobs there are in all (not hidden), whatever else is filtered.
  const newCountQuery = useJobsPage(
    { page: 1, pageSize: 1, filter: { createdAfter: newSince ?? '' } },
    { enabled: newSince !== null },
  );

  const jobs = jobsQuery.data?.items ?? NO_JOBS;
  const openOnPage = jobs.find((job) => job.id === openJobId);
  // A job opened from the Apply queue may be on another page or filtered out: fetch it.
  const openFetched = useJob(openJobId, { enabled: openJobId !== null && !openOnPage });
  const openJob = openOnPage ?? (openFetched.data?.id === openJobId ? openFetched.data : null);
  // Only the ticked jobs still on screen count, so a new page or filter starts with none.
  const selectedJobs = useMemo(() => jobs.filter((job) => checked.has(job.id)), [jobs, checked]);
  const selected = useMemo(() => new Set(selectedJobs.map((job) => job.id)), [selectedJobs]);

  const handleSort = useCallback((field: JobSortField) => dispatch(cycleSort(field)), [dispatch]);
  const handleToggleFilter = useCallback(
    (key: ListFilterKey, value: string) => dispatch(toggleFilterValue({ key, value })),
    [dispatch],
  );
  const handleClearFilter = useCallback(
    (key: ListFilterKey) => dispatch(clearFilter(key)),
    [dispatch],
  );
  const handleSearch = useCallback((value: string) => dispatch(setSearch(value)), [dispatch]);
  const handleOpenJob = useCallback((job: Job) => {
    setOpenJobId(job.id);
  }, []);
  const handleSetStatus = useCallback(
    (job: Job, status: ApplicationStatus) => {
      updateStatus.mutate({ id: job.id, status });
    },
    [updateStatus],
  );

  /** Hides the jobs (or brings them back, in Hidden jobs) and offers to undo it. */
  const changeHidden = useCallback(
    async (changed: Job[]) => {
      const hidden = !showingHidden;
      try {
        await Promise.all(changed.map((job) => setHidden.mutateAsync({ id: job.id, hidden })));
        setLastChange({ jobs: changed, hidden });
      } catch {
        // The error message under the toolbar says what went wrong.
      }
    },
    [setHidden, showingHidden],
  );
  const handleToggleHidden = useCallback(
    (job: Job) => {
      void changeHidden([job]);
    },
    [changeHidden],
  );
  // Which card matches what the table shows now: none when the Status column filter picks
  // something the cards don't cover, such as two statuses at once.
  const statuses = tableState.filters.applicationStatuses ?? [];
  const activeCard: StatCardKey | null = showingHidden
    ? 'hidden'
    : statuses.length === 0
      ? 'total'
      : statuses.length === 1 && STATUS_CARDS.includes(statuses[0] as StatCardKey)
        ? (statuses[0] as StatCardKey)
        : null;

  /** Shows the card's jobs in the table. Clicking the card that is on goes back to all jobs. */
  const selectCard = (key: StatCardKey) => {
    const target = key === activeCard ? 'total' : key;
    setLastChange(null);
    dispatch(setShowHidden(target === 'hidden'));
    const values = target === 'total' || target === 'hidden' ? [] : [target];
    dispatch(setFilterValues({ key: 'applicationStatuses', values }));
  };

  return (
    <section aria-labelledby="job-posts-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1
            id="job-posts-heading"
            className="text-2xl font-semibold tracking-tight text-slate-900"
          >
            {showingHidden ? 'Hidden jobs' : 'Job posts'}
          </h1>
          {!showingHidden && (
            <p className="text-sm text-slate-500">
              Search, filter and track the jobs you imported. Click a title for details.
            </p>
          )}
        </div>
      </div>
      <StatCards
        total={foundQuery.data?.total}
        applications={applications.data}
        hiddenCount={hiddenCount.data}
        active={activeCard}
        onSelect={selectCard}
        newCount={newSince === null ? 0 : newCountQuery.data?.total}
        newOnly={tableState.newOnly}
        onToggleNew={showingHidden ? undefined : () => dispatch(setNewOnly(!tableState.newOnly))}
      />
      {showingHidden && (
        <p className="text-sm text-slate-600">
          Only you don’t see these. Unhide a job to put it back in your table, or click “Jobs found”
          to go back.
        </p>
      )}

      {lastChange && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-lg items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span className="min-w-0 flex-1">
            {lastChange.hidden ? 'Hid' : 'Brought back'}{' '}
            {lastChange.jobs.length === 1 && lastChange.jobs[0]
              ? `“${lastChange.jobs[0].title}” at ${lastChange.jobs[0].company.name}.`
              : `${lastChange.jobs.length} jobs.`}
          </span>
          <button
            type="button"
            onClick={() => {
              const { jobs: changed, hidden } = lastChange;
              for (const job of changed) setHidden.mutate({ id: job.id, hidden: !hidden });
              setLastChange(null);
            }}
            className="font-semibold text-indigo-300 hover:text-indigo-200"
          >
            Undo
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setLastChange(null);
            }}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </p>
      )}

      {applying.pending.length > 0 && (
        <ul
          aria-label="Did you apply?"
          className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {applying.pending.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <span className="mr-auto">
                Did you apply to <span className="font-medium">{p.title}</span> at {p.company}?
              </span>
              <button
                type="button"
                onClick={() => {
                  updateStatus.mutate({ id: p.id, status: 'APPLIED' });
                  applying.answer(p.id);
                }}
                className="rounded-md bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-700"
              >
                Yes, mark Applied
              </button>
              <button
                type="button"
                onClick={() => {
                  applying.answer(p.id);
                }}
                className="rounded-md px-3 py-1 text-emerald-800 hover:bg-emerald-100"
              >
                Not yet
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showingHidden && <ApplyQueuePanel onOpenJob={setOpenJobId} />}

      <Toolbar
        search={tableState.search}
        onSearch={handleSearch}
        activeFilterCount={countActiveFilters(tableState)}
        onClearAll={() => dispatch(clearAll())}
        quickFilters={
          <QuickFilters
            filters={tableState.filters}
            filterOptions={filterOptions.data}
            postedWithinDays={tableState.postedWithinDays}
            minFit={tableState.minFit}
            onToggleFilter={handleToggleFilter}
            onClearFilter={handleClearFilter}
            onPostedWithin={(days) => dispatch(setPostedWithinDays(days))}
            onMinFit={(minFit) => dispatch(setMinFit(minFit))}
          />
        }
      >
        {/* Fit % updates by itself; this is only a "just in case" button. */}
        <button
          type="button"
          onClick={() => {
            recalculateFit.mutate();
          }}
          disabled={recalculateFit.isPending}
          title="Fit % updates by itself when your resume or the jobs change. Click to work it out again now"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {recalculateFit.isPending ? 'Recalculating…' : 'Recalculate Fit'}
        </button>
        <ColumnsMenu
          columns={COLUMN_CHOICES}
          visibility={columnVisibility.visibility}
          onToggle={columnVisibility.toggle}
          onShowAll={columnVisibility.showAll}
        />
      </Toolbar>

      {selectedJobs.length > 0 && (
        <div
          role="region"
          aria-label="Selected jobs"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-900"
        >
          <span className="mr-auto font-medium">{selectedJobs.length} selected</span>
          {!showingHidden && (
            <button
              type="button"
              onClick={() => {
                for (const job of selectedJobs) {
                  if (job.applicationStatus === 'NONE') handleSetStatus(job, 'SAVED');
                }
                setChecked(new Set());
              }}
              className="rounded-md bg-white px-3 py-1 font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
            >
              Save
            </button>
          )}
          {!showingHidden && (
            <button
              type="button"
              onClick={() => {
                changeQueue.mutate({ jobIds: selectedJobs.map((job) => job.id) });
                setChecked(new Set());
              }}
              className="rounded-md bg-white px-3 py-1 font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
            >
              Add to Apply queue
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void changeHidden(selectedJobs);
              setChecked(new Set());
            }}
            className="rounded-md bg-white px-3 py-1 font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
          >
            {showingHidden ? 'Unhide' : 'Hide'}
          </button>
          <button
            type="button"
            onClick={() => {
              setChecked(new Set());
            }}
            className="px-2 py-1 text-indigo-700 hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {jobsQuery.isError && (
        <div role="alert" className={ERROR_BOX}>
          Could not load jobs: {getErrorMessage(jobsQuery.error)}
        </div>
      )}
      {setHidden.isError && (
        <div role="alert" className={ERROR_BOX}>
          Could not change that: {getErrorMessage(setHidden.error)}
        </div>
      )}
      {changeQueue.isError && (
        <div role="alert" className={ERROR_BOX}>
          Could not add to the Apply queue: {getErrorMessage(changeQueue.error)}
        </div>
      )}
      {updateStatus.isError && (
        <div role="alert" className={ERROR_BOX}>
          Could not update the status: {getErrorMessage(updateStatus.error)}
        </div>
      )}

      <JobsTable
        jobs={jobs}
        sort={tableState.sort}
        filters={tableState.filters}
        filterOptions={filterOptions.data}
        onSort={handleSort}
        onToggleFilter={handleToggleFilter}
        onClearFilter={handleClearFilter}
        openJob={handleOpenJob}
        setStatus={handleSetStatus}
        toggleHidden={handleToggleHidden}
        showingHidden={showingHidden}
        newSince={newSince}
        isFetching={jobsQuery.isFetching && !jobsQuery.isPending}
        columnVisibility={columnVisibility.visibility}
        selected={selected}
        onSelectionChange={setChecked}
      />

      {jobsQuery.isPending && <p className="text-center text-sm text-slate-500">Loading jobs…</p>}
      {jobsQuery.isSuccess && jobs.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {showingHidden
            ? 'No hidden jobs match.'
            : 'No jobs match. Try clearing some filters, or add jobs from the “Add jobs” page.'}
        </p>
      )}

      {jobsQuery.data && (
        <Pagination
          page={tableState.page}
          pageSize={tableState.pageSize}
          total={jobsQuery.data.total}
          onPageChange={(page) => dispatch(setPage(page))}
          onPageSizeChange={(size) => dispatch(setPageSize(size))}
        />
      )}

      <JobDetailsDialog
        job={openJob}
        onClose={() => {
          setOpenJobId(null);
        }}
        onStatusChange={(status) => {
          if (openJob) handleSetStatus(openJob, status);
        }}
        onToggleHidden={handleToggleHidden}
        showingHidden={showingHidden}
        asking={askingIds}
        onApplyStarted={applying.start}
        onApplyAnswered={(job) => {
          applying.answer(job.id);
        }}
      />
    </section>
  );
}
