import type { ApplicationStatus, Job, JobSortField, ListFilterKey } from '@jobsearch/data';
import {
  clearAll,
  clearFilter,
  countActiveFilters,
  cycleSort,
  setPage,
  setPageSize,
  setFilterValues,
  setMinFit,
  setNewOnly,
  setQueueOnly,
  setNewSince,
  setPostedWithinDays,
  setSearch,
  setShowHidden,
  toggleFilterValue,
  toJobsPageArgs,
  useAppDispatch,
  useAppSelector,
  useApplyQueue,
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
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useErrorText } from '../../i18n/useErrorText';
import { ApplyQueuePanel } from './components/ApplyQueuePanel';
import { DEFAULT_HIDDEN_COLUMNS, MENU_COLUMNS } from './components/columns';
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
import { useSavedTableSettings } from './useSavedTableSettings';

/** How long the "Job hidden · Undo" bar stays before it goes away by itself. */
const UNDO_SHOW_MS = 8000;
const NO_JOBS: Job[] = [];
const STATUS_CARDS: StatCardKey[] = ['SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED'];

const ERROR_BOX = 'rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800';

/** Connects the table to Redux (what the user chose) and TanStack Query (the data). */
export function JobsDashboard() {
  const errorText = useErrorText();
  const t = useTranslations('Jobs');
  const dispatch = useAppDispatch();
  const tableState = useAppSelector((state) => state.jobsTable);
  const args = useMemo(() => toJobsPageArgs(tableState), [tableState]);

  // Your saved filters and sort are put back first, so the table loads once, the way you left it.
  const settingsReady = useSavedTableSettings();
  const jobsQuery = useJobsPage(args, { enabled: settingsReady });
  const filterOptions = useJobFilterOptions();
  const updateStatus = useUpdateJobStatus();
  const setHidden = useSetJobHidden();
  const changeQueue = useChangeApplyQueue();
  const recalculateFit = useRecalculateFit();
  const hiddenCount = useHiddenJobCount();
  const applications = useMyApplications();
  const columnVisibility = useColumnVisibility(DEFAULT_HIDDEN_COLUMNS);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  // A link like /jobs?job=<id> (from a notification) opens that job, then the URL is tidied.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const linkedJob = searchParams.get('job');
  const [handledLink, setHandledLink] = useState<string | null>(null);
  if (linkedJob !== handledLink) {
    setHandledLink(linkedJob);
    if (linkedJob) setOpenJobId(linkedJob);
  }
  useEffect(() => {
    if (linkedJob) router.replace(pathname, { scroll: false });
  }, [linkedJob, router, pathname]);
  // The last jobs hidden or brought back, for the "Undo" message.
  const [lastChange, setLastChange] = useState<{ jobs: Job[]; hidden: boolean } | null>(null);
  // The "Job hidden · Undo" bar goes away by itself after a while.
  useEffect(() => {
    if (!lastChange) return;
    const timer = setTimeout(() => {
      setLastChange(null);
    }, UNDO_SHOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [lastChange]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const applying = usePendingApplies();
  const askingIds = useMemo(() => new Set(applying.pending.map((p) => p.id)), [applying.pending]);
  const showingHidden = tableState.showHidden;
  const columnChoices = useMemo(
    () => MENU_COLUMNS.map((column) => ({ ...column, label: t(`columns.${column.id}`) })),
    [t],
  );

  // "All jobs" counts your search and column filters, whatever the status card picked.
  const foundArgs = useMemo(() => {
    const filters = { ...tableState.filters };
    Reflect.deleteProperty(filters, 'applicationStatuses');
    return toJobsPageArgs({
      ...tableState,
      filters,
      // New and the queue are views of the list, not filters on the All jobs count.
      newOnly: false,
      queueOnly: false,
      showHidden: false,
      sort: null,
      page: 1,
      pageSize: 1,
    });
  }, [tableState]);
  const foundQuery = useJobsPage(foundArgs, { enabled: settingsReady });

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
  // Each queued job's number, for the "Queue #2" badge in the table.
  const applyQueue = useApplyQueue();
  const queueNumbers = useMemo(
    () => new Map((applyQueue.data ?? []).map((item) => [item.jobId, item.number])),
    [applyQueue.data],
  );
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
      ? tableState.newOnly || tableState.queueOnly
        ? null
        : 'total'
      : statuses.length === 1 && STATUS_CARDS.includes(statuses[0] as StatCardKey)
        ? (statuses[0] as StatCardKey)
        : null;

  /** Shows the card's jobs in the table. Clicking the card that is on goes back to all jobs. */
  const selectCard = (key: StatCardKey) => {
    const target = key === activeCard ? 'total' : key;
    setLastChange(null);
    // Picking a card leaves the New and queue views.
    dispatch(setNewOnly(false));
    dispatch(setQueueOnly(false));
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
            {showingHidden ? t('hiddenTitle') : t('title')}
          </h1>
          {!showingHidden && <p className="text-sm text-slate-500">{t('intro')}</p>}
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
      {showingHidden && <p className="text-sm text-slate-600">{t('hiddenIntro')}</p>}

      {lastChange && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-lg items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span className="min-w-0 flex-1">
            {lastChange.jobs.length === 1 && lastChange.jobs[0]
              ? t(lastChange.hidden ? 'undo.hidOne' : 'undo.backOne', {
                  title: lastChange.jobs[0].title,
                  company: lastChange.jobs[0].company.name,
                })
              : t(lastChange.hidden ? 'undo.hidMany' : 'undo.backMany', {
                  count: lastChange.jobs.length,
                })}
          </span>
          <button
            type="button"
            onClick={() => {
              const { jobs: changed, hidden } = lastChange;
              for (const job of changed) setHidden.mutate({ id: job.id, hidden: !hidden });
              setLastChange(null);
            }}
            className="font-semibold text-brand-300 hover:text-brand-200"
          >
            {t('undo.undo')}
          </button>
          <button
            type="button"
            aria-label={t('undo.dismiss')}
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
          aria-label={t('pending.label')}
          className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {applying.pending.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <span className="mr-auto">
                {t.rich('pending.question', {
                  title: p.title,
                  company: p.company,
                  b: (chunks) => <span className="font-medium">{chunks}</span>,
                })}
              </span>
              <button
                type="button"
                onClick={() => {
                  updateStatus.mutate({ id: p.id, status: 'APPLIED' });
                  applying.answer(p.id);
                }}
                className="rounded-md bg-brand-600 px-3 py-1 font-medium text-white hover:bg-brand-700"
              >
                {t('pending.yes')}
              </button>
              <button
                type="button"
                onClick={() => {
                  applying.answer(p.id);
                }}
                className="rounded-md px-3 py-1 text-emerald-800 hover:bg-emerald-100"
              >
                {t('pending.notYet')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showingHidden && (
        <ApplyQueuePanel
          onOpenJob={setOpenJobId}
          queueOnly={tableState.queueOnly}
          onToggleQueueOnly={() => dispatch(setQueueOnly(!tableState.queueOnly))}
        />
      )}

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
          title={t('recalculate.hint')}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {recalculateFit.isPending ? t('recalculate.busy') : t('recalculate.button')}
        </button>
        <ColumnsMenu
          columns={columnChoices}
          visibility={columnVisibility.visibility}
          onToggle={columnVisibility.toggle}
          onShowAll={columnVisibility.showAll}
        />
      </Toolbar>

      {selectedJobs.length > 0 && (
        <div
          role="region"
          aria-label={t('selection.label')}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-900"
        >
          <span className="mr-auto font-medium">
            {t('selection.count', { count: selectedJobs.length })}
          </span>
          {!showingHidden && (
            <button
              type="button"
              onClick={() => {
                for (const job of selectedJobs) {
                  if (job.applicationStatus === 'NONE') handleSetStatus(job, 'SAVED');
                }
                setChecked(new Set());
              }}
              className="rounded-md bg-white px-3 py-1 font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
            >
              {t('selection.save')}
            </button>
          )}
          {!showingHidden && (
            <button
              type="button"
              onClick={() => {
                changeQueue.mutate({ jobIds: selectedJobs.map((job) => job.id) });
                setChecked(new Set());
              }}
              className="rounded-md bg-white px-3 py-1 font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
            >
              {t('selection.addToQueue')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void changeHidden(selectedJobs);
              setChecked(new Set());
            }}
            className="rounded-md bg-white px-3 py-1 font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
          >
            {showingHidden ? t('selection.unhide') : t('selection.hide')}
          </button>
          <button
            type="button"
            onClick={() => {
              setChecked(new Set());
            }}
            className="px-2 py-1 text-brand-700 hover:underline"
          >
            {t('selection.clear')}
          </button>
        </div>
      )}

      {jobsQuery.isError && (
        <div role="alert" className={ERROR_BOX}>
          {t('errors.load', { error: errorText(jobsQuery.error) })}
        </div>
      )}
      {setHidden.isError && (
        <div role="alert" className={ERROR_BOX}>
          {t('errors.hide', { error: errorText(setHidden.error) })}
        </div>
      )}
      {changeQueue.isError && (
        <div role="alert" className={ERROR_BOX}>
          {t('errors.queue', { error: errorText(changeQueue.error) })}
        </div>
      )}
      {updateStatus.isError && (
        <div role="alert" className={ERROR_BOX}>
          {t('errors.status', { error: errorText(updateStatus.error) })}
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
        queueNumbers={queueNumbers}
        isFetching={jobsQuery.isFetching && !jobsQuery.isPending}
        columnVisibility={columnVisibility.visibility}
        selected={selected}
        onSelectionChange={setChecked}
      />

      {jobsQuery.isPending && <p className="text-center text-sm text-slate-500">{t('loading')}</p>}
      {jobsQuery.isSuccess && jobs.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {showingHidden ? t('noHidden') : t('noJobs')}
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
