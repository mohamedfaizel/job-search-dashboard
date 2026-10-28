import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { JOB_INSIGHTS, REMOVE_INSIGHT_TERM, RESTORE_INSIGHT_TERM } from './operations';
import type { JobInsights } from './types';

/** All insights share this prefix, so a new resume can refresh every job's at once. */
export const jobInsightsPrefix = ['insights'] as const;
export const jobInsightsKey = (jobId: string) => [...jobInsightsPrefix, jobId] as const;

/** Skills, keywords and language of a job, checked against your resume. Free: no AI. */
export function useJobInsights(jobId: string | null) {
  return useQuery({
    queryKey: jobInsightsKey(jobId ?? ''),
    queryFn: async () => {
      const data = await graphqlClient.request<{ jobInsights: JobInsights }>(JOB_INSIGHTS, {
        jobId,
      });
      return data.jobInsights;
    },
    enabled: jobId !== null,
  });
}

/**
 * Removes a skill or keyword with ×, from this job or (everywhere: true) from every job. The
 * answer is the job's new insights. A term removed everywhere changes other jobs too, so their
 * cached insights are refreshed.
 */
export function useRemoveInsightTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { jobId: string; term: string; everywhere?: boolean }) => {
      const data = await graphqlClient.request<{ removeInsightTerm: JobInsights }>(
        REMOVE_INSIGHT_TERM,
        vars,
      );
      return data.removeInsightTerm;
    },
    onSuccess: (insights, vars) => {
      queryClient.setQueryData(jobInsightsKey(insights.jobId), insights);
      if (vars.everywhere) void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
    },
  });
}

/** Undoes a removal, for this job and everywhere. */
export function useRestoreInsightTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { jobId: string; term: string }) => {
      const data = await graphqlClient.request<{ restoreInsightTerm: JobInsights }>(
        RESTORE_INSIGHT_TERM,
        vars,
      );
      return data.restoreInsightTerm;
    },
    onSuccess: (insights) => {
      queryClient.setQueryData(jobInsightsKey(insights.jobId), insights);
      void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
    },
  });
}
