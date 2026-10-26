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
  toggleFilterValue,
  toJobsPageArgs,
  useAppDispatch,
  useAppSelector,
  useJobFilterOptions,
  useJobsPage,
  useUpdateJobStatus,
} from '@jobsearch/data';
import { useCallback, useMemo, useState } from 'react';
import { JobDetailsDialog } from './components/JobDetailsDialog';
import { JobsTable } from './components/JobsTable';
import { Pagination } from './components/Pagination';
import { Toolbar } from './components/Toolbar';

const NO_JOBS: Job[] = [];

/** Connects the table to Redux (what the user chose) and TanStack Query (the data). */
export function JobsDashboard() {
  const dispatch = useAppDispatch();
  const tableState = useAppSelector((state) => state.jobsTable);
  const args = useMemo(() => toJobsPageArgs(tableState), [tableState]);

  const jobsQuery = useJobsPage(args);
  const filterOptions = useJobFilterOptions();
  const updateStatus = useUpdateJobStatus();
  const [openJobId, setOpenJobId] = useState<string | null>(null);

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

  return (
    <section aria-labelledby="job-posts-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 id="job-posts-heading" className="text-xl font-semibold text-slate-900">
          Job posts
        </h1>
      </div>

      <Toolbar
        search={tableState.search}
        onSearch={handleSearch}
        activeFilterCount={countActiveFilters(tableState)}
        onClearAll={() => dispatch(clearAll())}
      />

      {jobsQuery.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Could not load jobs: {getErrorMessage(jobsQuery.error)}
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
        isFetching={jobsQuery.isFetching && !jobsQuery.isPending}
      />

      {jobsQuery.isPending && <p className="text-center text-sm text-slate-500">Loading jobs…</p>}
      {jobsQuery.isSuccess && jobs.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No jobs match. Try clearing some filters, or add jobs from the “Add a job” tab.
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
