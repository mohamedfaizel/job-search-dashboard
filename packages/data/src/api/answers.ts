import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { jobInsightsKey } from './insights';
import { DELETE_SAVED_ANSWER, SAVE_ANSWER, SAVE_CLAUDE_ANSWERS, SAVED_ANSWERS } from './operations';
import type { JobInsights, SavedAnswer } from './types';

export const savedAnswersKey = ['savedAnswers'] as const;

/** Your answers to Claude's questions, kept for the next jobs. */
export function useSavedAnswers({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    enabled,
    queryKey: savedAnswersKey,
    queryFn: async () => {
      const data = await graphqlClient.request<{ savedAnswers: SavedAnswer[] }>(SAVED_ANSWERS);
      return data.savedAnswers;
    },
  });
}

/** Keeps an answer for the next jobs. The same question again replaces its answer. */
export function useSaveAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { question: string; answer: string }) => {
      const data = await graphqlClient.request<{ saveAnswer: SavedAnswer }>(SAVE_ANSWER, vars);
      return data.saveAnswer;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: savedAnswersKey }),
  });
}

export function useDeleteSavedAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await graphqlClient.request(DELETE_SAVED_ANSWER, { id });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: savedAnswersKey }),
  });
}

/** Keeps your decisions on Claude's questions for one job (JSON text). */
export function useSaveClaudeAnswers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { jobId: string; answers: string }) => {
      const data = await graphqlClient.request<{ saveClaudeAnswers: JobInsights }>(
        SAVE_CLAUDE_ANSWERS,
        vars,
      );
      return data.saveClaudeAnswers;
    },
    onSuccess: (insights) => {
      queryClient.setQueryData(jobInsightsKey(insights.jobId), insights);
    },
  });
}
