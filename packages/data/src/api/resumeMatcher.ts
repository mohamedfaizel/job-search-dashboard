import { useMutation, useQuery } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { RESUME_MATCHER_STATUS } from './operations';
import type { ResumeMatcherStatus } from './types';

export const resumeMatcherStatusKey = ['resumeMatcher', 'status'] as const;

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
