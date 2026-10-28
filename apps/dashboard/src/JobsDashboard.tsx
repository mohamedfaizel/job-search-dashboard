import type { ApplicationStatus, Job, JobSortField, ListFilterKey } from '@jobsearch/data';
import {
  clearAll,
  clearFilter,
  countActiveFilters,
  cycleSort,
  getErrorMessage,
  setPage,
  setPageSize,
  setSearch,
  setShowHidden,
  toggleFilterValue,
  toJobsPageArgs,
  useAppDispatch,
  useAppSelector,
  useJobFilterOptions,
  useHiddenJobCount,
  useJobsPage,
  useMyApplications,
  useSetJobHidden,
  useUpdateJobStatus,
} from '@jobsearch/data';
import { useCallback, useMemo, useState } from 'react';
import { columns } from './components/columns';
import { ColumnsMenu } from './components/ColumnsMenu';
import { JobDetailsDialog } from './components/JobDetailsDialog';
import { JobsTable } from './components/JobsTable';
import { Pagination } from './components/Pagination';
import { StatCards } from './components/StatCards';
import { Toolbar } from './components/Toolbar';
import { useColumnVisibility } from './useColumnVisibility';

const NO_JOBS: Job[] = [];

/** Every column for the Columns menu, in table order. */
const COLUMN_CHOICES = columns.map((column) => ({
  // Accessor columns take their id from the field they read.
  id: column.id ?? ('accessorKey' in column ? String(column.accessorKey) : ''),
  label: String(column.header),
  canHide: column.enableHiding !== false,
}));

/** Connects the table to Redux (what the user chose) and TanStack Query (the data). */
export function JobsDashboard() {
  const dispatch = useAppDispatch();
  const tableState = useAppSelector((state) => state.jobsTable);
  const args = useMemo(() => toJobsPageArgs(tableState), [tableState]);

  const jobsQuery = useJobsPage(args);
  const filterOptions = useJobFilterOptions();
  const updateStatus = useUpdateJobStatus();
  const setHidden = useSetJobHidden();
  const hiddenCount = useHiddenJobCount();
  const applications = useMyApplications();
  const columnVisibility = useColumnVisibility();
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  // The last job hidden or brought back, for the "Undo" message.
  const [lastChange, setLastChange] = useState<{ job: Job; hidden: boolean } | null>(null);
  const showingHidden = tableState.showHidden;

  const jobs = jobsQuery.data?.items ?? NO_JOBS;
  const openJob = jobs.find((job) => job.id === openJobId) ?? null;

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

  const handleToggleHidden = useCallback(
    (job: Job) => {
      const hidden = !showingHidden;
      setHidden.mutate(
        { id: job.id, hidden },
        {
          onSuccess: () => {
            setLastChange({ job, hidden });
          },
        },
      );
    },
    [setHidden, showingHidden],
  );
  const switchView = (hidden: boolean) => {
    setLastChange(null);
    dispatch(setShowHidden(hidden));
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
        {showingHidden ? (
          <button
            type="button"
            onClick={() => {
              switchView(false);
            }}
            className="text-sm text-indigo-700 hover:underline"
          >
            Back to job posts
          </button>
        ) : (
          (hiddenCount.data ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => {
                switchView(true);
              }}
              className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
            >
              Hidden jobs ({hiddenCount.data})
            </button>
          )
        )}
      </div>
      {!showingHidden && (
        <StatCards
          total={jobsQuery.data?.total}
          applications={applications.data}
          hiddenCount={hiddenCount.data}
        />
      )}
      {showingHidden && (
        <p className="text-sm text-slate-600">
          Only you don’t see these. Unhide a job to put it back in your table.
        </p>
      )}

      {lastChange && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"
        >
          {lastChange.hidden ? 'Hid' : 'Brought back'} “{lastChange.job.title}” at{' '}
          {lastChange.job.company.name}.
          <button
            type="button"
            onClick={() => {
              const { job, hidden } = lastChange;
              setHidden.mutate({ id: job.id, hidden: !hidden });
              setLastChange(null);
            }}
            className="font-medium text-indigo-700 hover:underline"
          >
            Undo
          </button>
        </p>
      )}

      <Toolbar
        search={tableState.search}
        onSearch={handleSearch}
        activeFilterCount={countActiveFilters(tableState)}
        onClearAll={() => dispatch(clearAll())}
      >
        <ColumnsMenu
          columns={COLUMN_CHOICES}
          visibility={columnVisibility.visibility}
          onToggle={columnVisibility.toggle}
          onShowAll={columnVisibility.showAll}
        />
      </Toolbar>

      {jobsQuery.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Could not load jobs: {getErrorMessage(jobsQuery.error)}
        </div>
      )}
      {setHidden.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Could not change that: {getErrorMessage(setHidden.error)}
        </div>
      )}
      {updateStatus.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
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
        isFetching={jobsQuery.isFetching && !jobsQuery.isPending}
        columnVisibility={columnVisibility.visibility}
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
      />
    </section>
  );
}
