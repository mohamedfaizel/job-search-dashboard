import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, graphqlClient } from './client';
import {
  DELETE_JOB_RESUME,
  JOB_INSIGHTS,
  REMOVE_INSIGHT_TERM,
  RESTORE_INSIGHT_TERM,
  SAVE_JOB_RESUME_TEXT,
} from './operations';
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

/**
 * Where the resume you wrote for a job is uploaded (POST) and downloaded (GET). Plain REST:
 * files go as multipart/form-data, and the login cookie goes with the link.
 */
export function jobResumeUrl(jobId: string) {
  return `${API_URL.replace(/\/graphql\/?$/, '')}/job-resume/${encodeURIComponent(jobId)}`;
}

/** Uploads the resume you wrote for a job (PDF, Word, text or Markdown) and scores it. */
export function useUploadJobResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, file }: { jobId: string; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(jobResumeUrl(jobId), {
        method: 'POST',
        body,
        credentials: 'include',
      });
      const json = (await res.json().catch(() => null)) as
        (JobInsights & { message?: unknown }) | null;
      if (!res.ok) {
        const message = json?.message;
        throw new Error(
          typeof message === 'string' ? message : `Upload failed (${String(res.status)})`,
        );
      }
      return json as JobInsights;
    },
    onSuccess: (insights) => {
      queryClient.setQueryData(jobInsightsKey(insights.jobId), insights);
    },
  });
}

/** Saves pasted text as the resume you wrote for a job and scores it. */
export function useSaveJobResumeText() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { jobId: string; text: string }) => {
      const data = await graphqlClient.request<{ saveJobResumeText: JobInsights }>(
        SAVE_JOB_RESUME_TEXT,
        vars,
      );
      return data.saveJobResumeText;
    },
    onSuccess: (insights) => {
      queryClient.setQueryData(jobInsightsKey(insights.jobId), insights);
    },
  });
}

/** Deletes the resume you wrote for a job. */
export function useDeleteJobResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const data = await graphqlClient.request<{ deleteJobResume: JobInsights }>(
        DELETE_JOB_RESUME,
        { jobId },
      );
      return data.deleteJobResume;
    },
    onSuccess: (insights) => {
      queryClient.setQueryData(jobInsightsKey(insights.jobId), insights);
    },
  });
}
