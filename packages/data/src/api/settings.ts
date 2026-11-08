import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import {
  DELETE_API_KEY,
  MY_API_KEYS,
  SAVE_API_KEY,
  TEST_API_KEY,
  UPDATE_NOTIFICATION_SETTINGS,
} from './operations';
import { profileKey } from './profile';
import type { ApiKey, ApiKeyKind, ApiKeyTest, NotificationSettingsInput, Profile } from './types';

export const apiKeysKey = ['settings', 'apiKeys'] as const;

/** Your saved keys (only their last 4 characters). */
export function useMyApiKeys() {
  return useQuery({
    queryKey: apiKeysKey,
    queryFn: async () =>
      (await graphqlClient.request<{ myApiKeys: ApiKey[] }>(MY_API_KEYS)).myApiKeys,
  });
}

export function useSaveApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kind: ApiKeyKind; value: string; model?: string | null }) =>
      (await graphqlClient.request<{ saveApiKey: ApiKey }>(SAVE_API_KEY, { input })).saveApiKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeysKey }),
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kind: ApiKeyKind) => {
      await graphqlClient.request(DELETE_API_KEY, { kind });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeysKey }),
  });
}

/** Tries a saved key against its service (JobHunter: a one-job search, at most 1 credit). */
export function useTestApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kind: ApiKeyKind) =>
      (await graphqlClient.request<{ testApiKey: ApiKeyTest }>(TEST_API_KEY, { kind })).testApiKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeysKey }),
  });
}

/** Settings > Notifications: saved apart from the profile form. */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NotificationSettingsInput) =>
      (
        await graphqlClient.request<{ updateNotificationSettings: Profile }>(
          UPDATE_NOTIFICATION_SETTINGS,
          { input },
        )
      ).updateNotificationSettings,
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
    },
  });
}
