import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import {
  CREATE_JOB,
  CREATE_SAVED_SEARCH,
  DELETE_SAVED_SEARCH,
  HIDDEN_JOB_COUNT,
  HIDE_JOB,
  IMPORT_BUDGET,
  JOBS_PAGE,
  JOB_FILTER_OPTIONS,
  MY_APPLICATIONS,
  RUN_SAVED_SEARCH,
  SAVED_SEARCHES,
  SET_SAVED_SEARCH_SCHEDULE,
  START_JOBS_VISIT,
  SYNC_JOBS,
  SYNC_RUNS,
  UNHIDE_JOB,
  UPDATE_JOB_STATUS,
  UPDATE_SAVED_SEARCH,
} from './operations';
import type {
  Application,
  ApplicationStatus,
  CreateJobInput,
  ImportBudget,
  Job,
  JobFilterOptions,
  JobsPage,
  JobsPageArgs,
  SavedSearch,
  SavedSearchInput,
  ScheduleFrequency,
  SyncJobsInput,
  SyncJobsResult,
  SyncRun,
} from './types';

/** Query keys in one place, so mutations know exactly what to refresh. */
export const queryKeys = {
  jobs: ['jobs'] as const,
  jobsPage: (args: JobsPageArgs) => ['jobs', 'page', args] as const,
  filterOptions: ['jobs', 'filterOptions'] as const,
  // Under 'jobs', so anything that refreshes the jobs refreshes the count too.
  hiddenJobCount: ['jobs', 'hiddenCount'] as const,
  applications: ['jobs', 'applications'] as const,
  savedSearches: ['savedSearches'] as const,
  syncRuns: ['syncRuns'] as const,
  importBudget: ['importBudget'] as const,
  // Not under 'jobs': refreshing the jobs must not start a new visit.
  jobsVisit: ['jobsVisit'] as const,
};

export function useJobsPage(args: JobsPageArgs, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    enabled,
    // Every argument is part of the key, so each filter/sort/page combination is cached.
    queryKey: queryKeys.jobsPage(args),
    queryFn: async () => {
      const data = await graphqlClient.request<{ jobsPage: JobsPage }>(JOBS_PAGE, { ...args });
      return data.jobsPage;
    },
    // Keep showing the current page while the next one loads, instead of flashing empty.
    placeholderData: keepPreviousData,
  });
}

export function useJobFilterOptions() {
  return useQuery({
    queryKey: queryKeys.filterOptions,
    queryFn: async () => {
      const data = await graphqlClient.request<{ jobFilterOptions: JobFilterOptions }>(
        JOB_FILTER_OPTIONS,
      );
      return data.jobFilterOptions;
    },
    staleTime: 60_000,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateJobInput) => {
      const data = await graphqlClient.request<{ createJob: Job }>(CREATE_JOB, { input });
      return data.createJob;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs }),
  });
}

/** Your tracker board: every job you gave a status, most recently moved first. */
export function useMyApplications() {
  return useQuery({
    queryKey: queryKeys.applications,
    queryFn: async () => {
      const data = await graphqlClient.request<{ myApplications: Application[] }>(MY_APPLICATIONS);
      return data.myApplications;
    },
  });
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; status: ApplicationStatus }) => {
      const data = await graphqlClient.request<{
        updateJobStatus: Pick<Job, 'id' | 'applicationStatus'>;
      }>(UPDATE_JOB_STATUS, vars);
      return data.updateJobStatus;
    },
    // Optimistic update: move the card on the board right away instead of after the round trip.
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.applications });
      const previous = queryClient.getQueryData<Application[]>(queryKeys.applications);
      if (previous) {
        queryClient.setQueryData<Application[]>(
          queryKeys.applications,
          previous.map((app) => (app.job.id === id ? { ...app, status } : app)),
        );
      }
      return { previous };
    },
    // If the server said no, put the board back the way it was.
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.applications, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs }),
  });
}

/** How many jobs you have hidden. */
export function useHiddenJobCount() {
  return useQuery({
    queryKey: queryKeys.hiddenJobCount,
    queryFn: async () => {
      const data = await graphqlClient.request<{ hiddenJobCount: number }>(HIDDEN_JOB_COUNT);
      return data.hiddenJobCount;
    },
  });
}

/** Hides a job from your table, or brings it back. Other users are not affected. */
export function useSetJobHidden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      await graphqlClient.request(hidden ? HIDE_JOB : UNHIDE_JOB, { id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs }),
  });
}

export function useSyncJobs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SyncJobsInput) => {
      const data = await graphqlClient.request<{ syncJobs: SyncJobsResult }>(SYNC_JOBS, { input });
      return data.syncJobs;
    },
    onSuccess: () => refreshAfterImport(queryClient),
  });
}

/** An import adds jobs and a history row, and changes a saved search's "last run". */
function refreshAfterImport(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs }),
    queryClient.invalidateQueries({ queryKey: queryKeys.syncRuns }),
    queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches }),
    queryClient.invalidateQueries({ queryKey: queryKeys.importBudget }),
  ]);
}

/** The scheduler imports while the page is open, so these queries check back every minute. */
const SCHEDULER_POLL_MS = 60_000;

export function useImportBudget() {
  return useQuery({
    queryKey: queryKeys.importBudget,
    queryFn: async () => {
      const data = await graphqlClient.request<{ importBudget: ImportBudget }>(IMPORT_BUDGET);
      return data.importBudget;
    },
    refetchInterval: SCHEDULER_POLL_MS,
  });
}

export function useSetSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: number; schedule: ScheduleFrequency; runAt: string }) => {
      const data = await graphqlClient.request<{ setSavedSearchSchedule: SavedSearch }>(
        SET_SAVED_SEARCH_SCHEDULE,
        { id: vars.id, input: { schedule: vars.schedule, runAt: vars.runAt } },
      );
      return data.setSavedSearchSchedule;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches }),
  });
}

export function useSavedSearches() {
  return useQuery({
    queryKey: queryKeys.savedSearches,
    queryFn: async () => {
      const data = await graphqlClient.request<{ savedSearches: SavedSearch[] }>(SAVED_SEARCHES);
      return data.savedSearches;
    },
    refetchInterval: SCHEDULER_POLL_MS,
  });
}

export function useSyncRuns(limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.syncRuns, limit],
    queryFn: async () => {
      const data = await graphqlClient.request<{ syncRuns: SyncRun[] }>(SYNC_RUNS, { limit });
      return data.syncRuns;
    },
    refetchInterval: SCHEDULER_POLL_MS,
  });
}

/** Creates a saved search, or updates it when an id is given. */
export function useSaveSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: number; input: SavedSearchInput }) => {
      if (id === undefined) {
        const data = await graphqlClient.request<{ createSavedSearch: SavedSearch }>(
          CREATE_SAVED_SEARCH,
          { input },
        );
        return data.createSavedSearch;
      }
      const data = await graphqlClient.request<{ updateSavedSearch: SavedSearch }>(
        UPDATE_SAVED_SEARCH,
        { id, input },
      );
      return data.updateSavedSearch;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches }),
  });
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await graphqlClient.request(DELETE_SAVED_SEARCH, { id });
      return id;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches }),
        queryClient.invalidateQueries({ queryKey: queryKeys.syncRuns }),
      ]),
  });
}

export function useRunSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resume = false }: { id: number; resume?: boolean }) => {
      const data = await graphqlClient.request<{ runSavedSearch: SyncJobsResult }>(
        RUN_SAVED_SEARCH,
        { id, resume },
      );
      return data.runSavedSearch;
    },
    onSuccess: () => refreshAfterImport(queryClient),
  });
}

/**
 * Tells the API you opened Job posts, once per page load, and returns the time after which jobs
 * are New for this visit (null on your first visit). Kept for the whole page load, so the badges
 * don't move while you look around.
 */
export function useJobsVisit() {
  return useQuery({
    queryKey: queryKeys.jobsVisit,
    queryFn: async () => {
      const data = await graphqlClient.request<{ startJobsVisit: string | null }>(START_JOBS_VISIT);
      return data.startJobsVisit;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
