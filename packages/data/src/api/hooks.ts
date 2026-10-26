import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import {
  CREATE_JOB,
  JOB_FILTER_OPTIONS,
  JOBS_PAGE,
  SYNC_JOBS,
  UPDATE_JOB_STATUS,
} from './operations';
import type {
  ApplicationStatus,
  CreateJobInput,
  Job,
  JobFilterOptions,
  JobsPage,
  JobsPageArgs,
  SyncJobsInput,
  SyncJobsResult,
} from './types';

/** Query keys in one place, so mutations know exactly what to refresh. */
export const queryKeys = {
  jobs: ['jobs'] as const,
  jobsPage: (args: JobsPageArgs) => ['jobs', 'page', args] as const,
  filterOptions: ['jobs', 'filterOptions'] as const,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs }),
  });
}
