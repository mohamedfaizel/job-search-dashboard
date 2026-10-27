import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { API_URL, graphqlClient } from './client';
import { queryKeys } from './hooks';
import {
  JOB_MATCH,
  MATCH_JOB,
  MY_MATCHER_RESUME,
  RESUME_MATCHER_STATUS,
  SYNC_RESUME_TO_MATCHER,
  TAILOR_RESUME,
  TAILORED_RESUME,
} from './operations';
import type { JobMatch, MatcherResume, ResumeMatcherStatus, TailoredResume } from './types';

export const resumeMatcherStatusKey = ['resumeMatcher', 'status'] as const;
export const matcherResumeKey = ['resumeMatcher', 'resume'] as const;
const syncResumeKey = ['resumeMatcher', 'sync'] as const;
export const jobMatchKey = (jobId: string) => ['resumeMatcher', 'match', jobId] as const;

export const tailoredResumeKey = (jobId: string) => ['resumeMatcher', 'tailored', jobId] as const;

/** Download links for a tailored resume's PDFs. The login cookie goes with the link. */
export function tailoredPdfUrl(jobId: string, kind: 'resume' | 'cover-letter') {
  const base = API_URL.replace(/\/graphql\/?$/, '');
  return `${base}/tailored/${encodeURIComponent(jobId)}/${kind}.pdf`;
}

/** How often to ask whether a running match has finished. It takes a minute or two. */
const MATCH_POLL_MS = 3_000;

async function fetchStatus(checkAi: boolean) {
  const data = await graphqlClient.request<{ resumeMatcherStatus: ResumeMatcherStatus }>(
    RESUME_MATCHER_STATUS,
    { checkAi },
  );
  return data.resumeMatcherStatus;
}

/** Is Resume-Matcher running? Free to call: it never reaches the AI provider. */
export function useResumeMatcherStatus() {
  return useQuery({
    queryKey: resumeMatcherStatusKey,
    queryFn: () => fetchStatus(false),
    // Someone may start the container while the page is open, so check again now and then.
    refetchInterval: 60_000,
  });
}

/**
 * Sends one tiny test message to the AI provider through Resume-Matcher. It costs a fraction of
 * a cent, so it is a mutation the user triggers from a button, not a query that runs on load.
 */
export function useTestAiConnection() {
  return useMutation({ mutationFn: () => fetchStatus(true) });
}

/** Where your master resume stands in Resume-Matcher (not sent, ready, outdated, failed). */
export function useMyMatcherResume() {
  return useQuery({
    queryKey: matcherResumeKey,
    queryFn: async () => {
      const data = await graphqlClient.request<{ myMatcherResume: MatcherResume }>(
        MY_MATCHER_RESUME,
      );
      return data.myMatcherResume;
    },
  });
}

/**
 * Sends the uploaded resume file to Resume-Matcher. Its AI reads it, so this can take a minute.
 * Several components can start it (the upload, a "Send again" button); they all share the
 * mutation key, so any of them can show that a send is running.
 */
export function useSyncResumeToMatcher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: syncResumeKey,
    mutationFn: async () => {
      const data = await graphqlClient.request<{ syncResumeToMatcher: MatcherResume }>(
        SYNC_RESUME_TO_MATCHER,
      );
      return data.syncResumeToMatcher;
    },
    onSuccess: (resume) => {
      queryClient.setQueryData(matcherResumeKey, resume);
    },
  });
}

/** True while any component is sending the resume to Resume-Matcher. */
export function useIsSyncingResume() {
  return useIsMutating({ mutationKey: syncResumeKey }) > 0;
}

/**
 * Your resume match for one job (null if you never matched it). While Resume-Matcher works on
 * it the status is PENDING and this asks again every few seconds; once it finishes, the jobs
 * table is refreshed so its Match column shows the new score.
 */
export function useJobMatch(jobId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: jobMatchKey(jobId ?? ''),
    queryFn: async () => {
      const data = await graphqlClient.request<{ jobMatch: JobMatch | null }>(JOB_MATCH, {
        jobId,
      });
      return data.jobMatch;
    },
    enabled: jobId !== null,
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? MATCH_POLL_MS : false),
  });

  const status = query.data?.status;
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current === 'PENDING' && status !== 'PENDING') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    }
    previous.current = status;
  }, [status, queryClient]);

  return query;
}

/** Starts a match. The server answers at once with a PENDING match; useJobMatch polls it. */
export function useMatchJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const data = await graphqlClient.request<{ matchJob: JobMatch }>(MATCH_JOB, { jobId });
      return data.matchJob;
    },
    onSuccess: (match) => {
      queryClient.setQueryData(jobMatchKey(match.jobId), match);
      // The table shows "Matching…" for this job straight away.
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

/** Your tailored resume for one job (null if never tailored). Polls while it is PENDING. */
export function useTailoredResume(jobId: string) {
  return useQuery({
    queryKey: tailoredResumeKey(jobId),
    queryFn: async () => {
      const data = await graphqlClient.request<{ tailoredResume: TailoredResume | null }>(
        TAILORED_RESUME,
        { jobId },
      );
      return data.tailoredResume;
    },
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? MATCH_POLL_MS : false),
  });
}

/** Starts tailoring. The server answers at once with PENDING; useTailoredResume polls it. */
export function useTailorResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const data = await graphqlClient.request<{ tailorResume: TailoredResume }>(TAILOR_RESUME, {
        jobId,
      });
      return data.tailorResume;
    },
    onSuccess: (tailored) => {
      queryClient.setQueryData(tailoredResumeKey(tailored.jobId), tailored);
    },
  });
}
