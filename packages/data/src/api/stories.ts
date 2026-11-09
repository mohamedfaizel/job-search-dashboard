import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { jobInsightsPrefix } from './insights';
import { DELETE_STORY, SAVE_STORY, STORIES } from './operations';
import type { Story, StoryInput } from './types';

export const storiesKey = ['stories'] as const;

/** Your story bank, the story changed last first. */
export function useStories() {
  return useQuery({
    queryKey: storiesKey,
    queryFn: async () => (await graphqlClient.request<{ stories: Story[] }>(STORIES)).stories,
  });
}

/**
 * Adds a story (no id) or changes one. The interview prep prompt uses your stories, so the job
 * insights are read again.
 */
export function useSaveStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StoryInput) =>
      (await graphqlClient.request<{ saveStory: Story }>(SAVE_STORY, { input })).saveStory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: storiesKey });
      void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
    },
  });
}

export function useDeleteStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await graphqlClient.request(DELETE_STORY, { id });
      return id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: storiesKey });
      void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
    },
  });
}
