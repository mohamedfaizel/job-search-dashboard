import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { MY_MATCHER_RESUME, RESUME_MATCHER_STATUS, SYNC_RESUME_TO_MATCHER } from './operations';
import type { MatcherResume, ResumeMatcherStatus } from './types';

export const resumeMatcherStatusKey = ['resumeMatcher', 'status'] as const;
export const matcherResumeKey = ['resumeMatcher', 'resume'] as const;
const syncResumeKey = ['resumeMatcher', 'sync'] as const;

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
