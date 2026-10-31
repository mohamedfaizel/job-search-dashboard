import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, graphqlClient } from './client';
import { queryKeys } from './hooks';
import {
  ADD_TO_APPLY_QUEUE,
  APPLY_QUEUE,
  APPLY_QUEUE_PROMPT,
  DELETE_JOB_RESUME,
  JOB_INSIGHTS,
  RECALCULATE_FIT,
  REMOVE_FROM_APPLY_QUEUE,
  REMOVE_INSIGHT_TERM,
  RESTORE_INSIGHT_TERM,
  SAVE_APPLY_QUEUE_REPLY,
  SAVE_JOB_RESUME_TEXT,
  SET_HAVE_TERM,
} from './operations';
import type { ApplyQueueItem, ApplyQueuePrompt, JobInsights } from './types';

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
      // The job's Fit % in the table changes with it.
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

/**
 * "I have this": puts a missing skill or keyword on the Skills list of My profile (or takes it
 * off with have: false). It then counts as covered for every job, so all insights, the Fit %
 * column and the profile are refreshed.
 */
export function useSetHaveTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { jobId: string; term: string; have: boolean }) => {
      const data = await graphqlClient.request<{ setHaveTerm: JobInsights }>(SET_HAVE_TERM, vars);
      return data.setHaveTerm;
    },
    onSuccess: (insights) => {
      queryClient.setQueryData(jobInsightsKey(insights.jobId), insights);
      void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
      // The profile's Skills list changed too. (Its key is ['profile']: importing profileKey from
      // ./profile would make an import cycle, since profile.ts imports from this file.)
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

/**
 * Works out Fit % for every job again. The API already does this by itself whenever your resume,
 * removed terms or the jobs change, so this is only a "just in case" button.
 */
export function useRecalculateFit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const data = await graphqlClient.request<{ recalculateFit: number }>(RECALCULATE_FIT);
      return data.recalculateFit;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
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

/**
 * The Apply kit page for a job: plain text with your details, the form answers and the cover
 * letter, for Claude in Chrome to read before it fills in the application form.
 */
export function applyKitUrl(jobId: string) {
  return `${API_URL.replace(/\/graphql\/?$/, '')}/apply-kit/${encodeURIComponent(jobId)}`;
}

/** A saved or deleted reply changes the job's insights and whether it is ready in the queue. */
function savedReply(queryClient: QueryClient, insights: JobInsights) {
  queryClient.setQueryData(jobInsightsKey(insights.jobId), insights);
  void queryClient.invalidateQueries({ queryKey: applyQueueKey });
}

export const applyQueueKey = ['jobs', 'applyQueue'] as const;

/** The jobs you lined up to apply for, oldest first. Under 'jobs', so status changes refresh it. */
export function useApplyQueue() {
  return useQuery({
    queryKey: applyQueueKey,
    queryFn: async () => {
      const data = await graphqlClient.request<{ myApplyQueue: ApplyQueueItem[] }>(APPLY_QUEUE);
      return data.myApplyQueue;
    },
  });
}

/** Adds jobs to the Apply queue, or (remove: true) takes them out. Answers with the new queue. */
export function useChangeApplyQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobIds, remove = false }: { jobIds: string[]; remove?: boolean }) => {
      if (remove) {
        const data = await graphqlClient.request<{ removeFromApplyQueue: ApplyQueueItem[] }>(
          REMOVE_FROM_APPLY_QUEUE,
          { jobIds },
        );
        return data.removeFromApplyQueue;
      }
      const data = await graphqlClient.request<{ addToApplyQueue: ApplyQueueItem[] }>(
        ADD_TO_APPLY_QUEUE,
        { jobIds },
      );
      return data.addToApplyQueue;
    },
    onSuccess: (queue) => {
      queryClient.setQueryData(applyQueueKey, queue);
      void queryClient.invalidateQueries({ queryKey: applyQueuePromptKey });
    },
  });
}

export const applyQueuePromptKey = [...applyQueueKey, 'prompt'] as const;

/** One Claude prompt for the queued jobs that have no reply yet (up to 5). */
export function useApplyQueuePrompt({ enabled = true } = {}) {
  return useQuery({
    queryKey: applyQueuePromptKey,
    enabled,
    queryFn: async () => {
      const data = await graphqlClient.request<{ applyQueuePrompt: ApplyQueuePrompt }>(
        APPLY_QUEUE_PROMPT,
      );
      return data.applyQueuePrompt;
    },
  });
}

/** Saves Claude's reply to the queue prompt: each job's part to that job. */
export function useSaveApplyQueueReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const data = await graphqlClient.request<{ saveApplyQueueReply: ApplyQueueItem[] }>(
        SAVE_APPLY_QUEUE_REPLY,
        { text },
      );
      return data.saveApplyQueueReply;
    },
    onSuccess: (queue) => {
      queryClient.setQueryData(applyQueueKey, queue);
      void queryClient.invalidateQueries({ queryKey: applyQueuePromptKey });
      // Each saved job has a new resume, cover letter and score.
      void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
    },
  });
}

/** The Apply queue page: every queued job with its posting and Apply kit, for Claude in Chrome. */
export const APPLY_QUEUE_URL = `${API_URL.replace(/\/graphql\/?$/, '')}/apply-queue`;

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
      savedReply(queryClient, insights);
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
      savedReply(queryClient, insights);
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
      savedReply(queryClient, insights);
    },
  });
}
