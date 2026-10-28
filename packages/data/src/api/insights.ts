import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { JOB_INSIGHTS } from './operations';
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
