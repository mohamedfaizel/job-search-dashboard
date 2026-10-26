import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import {
  CREATE_JOB,
  CREATE_SAVED_SEARCH,
  DELETE_SAVED_SEARCH,
  JOB_FILTER_OPTIONS,
  JOBS_PAGE,
  RUN_SAVED_SEARCH,
  SAVED_SEARCHES,
  SYNC_JOBS,
  SYNC_RUNS,
  UPDATE_JOB_STATUS,
  UPDATE_SAVED_SEARCH,
} from './operations';
import type {
  ApplicationStatus,
  CreateJobInput,
  Job,
  JobFilterOptions,
  JobsPage,
  JobsPageArgs,
  SavedSearch,
  SavedSearchInput,
  SyncJobsInput,
  SyncJobsResult,
  SyncRun,
} from './types';

/** Query keys in one place, so mutations know exactly what to refresh. */
export const queryKeys = {
  jobs: ['jobs'] as const,
  jobsPage: (args: JobsPageArgs) => ['jobs', 'page', args] as const,
  filterOptions: ['jobs', 'filterOptions'] as const,
  savedSearches: ['savedSearches'] as const,
  syncRuns: ['syncRuns'] as const,
};

export function useJobsPage(args: JobsPageArgs) {
  return useQuery({
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

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; status: ApplicationStatus }) => {
      const data = await graphqlClient.request<{
        updateJobStatus: Pick<Job, 'id' | 'applicationStatus'>;
      }>(UPDATE_JOB_STATUS, vars);
      return data.updateJobStatus;
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
  ]);
}

export function useSavedSearches() {
  return useQuery({
    queryKey: queryKeys.savedSearches,
    queryFn: async () => {
      const data = await graphqlClient.request<{ savedSearches: SavedSearch[] }>(SAVED_SEARCHES);
      return data.savedSearches;
    },
  });
}

export function useSyncRuns(limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.syncRuns, limit],
    queryFn: async () => {
      const data = await graphqlClient.request<{ syncRuns: SyncRun[] }>(SYNC_RUNS, { limit });
      return data.syncRuns;
    },
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
