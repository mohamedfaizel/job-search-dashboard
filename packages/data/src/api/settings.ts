import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meKey } from './auth';
import { graphqlClient } from './client';
import {
  DELETE_API_KEY,
  MY_API_KEYS,
  SAVE_API_KEY,
  SET_AI_PROVIDER,
  SET_API_KEY_MODEL,
  TEST_API_KEY,
  SET_BRIEFING,
  SET_WEEKLY_REPORT,
  SET_MAIL_AUTO_STATUS,
  SET_NIGHTLY_KITS,
  UPDATE_NOTIFICATION_SETTINGS,
  KIT_RUN,
  WRITE_KITS_NOW,
} from './operations';
import { profileKey } from './profile';
import type {
  AiProvider,
  ApiKey,
  ApiKeyKind,
  ApiKeyTest,
  KitRun,
  NotificationSettingsInput,
  Profile,
  User,
} from './types';

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

/** Changes the AI model used with a saved key; null goes back to the default. */
export function useSetApiKeyModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kind: ApiKeyKind; model: string | null }) =>
      (await graphqlClient.request<{ setApiKeyModel: ApiKey }>(SET_API_KEY_MODEL, input))
        .setApiKeyModel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeysKey }),
  });
}

/** Picks Claude or OpenAI. Shown at once: the copy-and-open buttons follow it everywhere. */
export function useSetAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (provider: AiProvider) =>
      (await graphqlClient.request<{ setAiProvider: User }>(SET_AI_PROVIDER, { provider }))
        .setAiProvider,
    onMutate: (provider) => {
      const before = queryClient.getQueryData<User | null>(meKey);
      if (before) queryClient.setQueryData(meKey, { ...before, aiProvider: provider });
      return { before };
    },
    onError: (_error, _provider, context) => {
      if (context?.before) queryClient.setQueryData(meKey, context.before);
    },
    onSuccess: (user) => {
      queryClient.setQueryData(meKey, user);
    },
  });
}

/**
 * Tries a saved key against its service: JobHunter with a one-job search (at most 1 credit),
 * Claude and OpenAI by listing their models (free).
 */
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

/** Settings > API keys > Nightly apply kits: on or off, how many a night, and at what time. */
export function useSetNightlyKits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { on: boolean; perNight: number; at: string }) =>
      (await graphqlClient.request<{ setNightlyKits: boolean }>(SET_NIGHTLY_KITS, { input }))
        .setNightlyKits,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey }),
  });
}

export const kitRunKey = ['kitRun'] as const;
/** How often Settings asks for progress while kits are being written. */
export const KIT_RUN_POLL_MS = 3000;

/** "Write now": starts writing the queued jobs' kits. Returns how many; the bell says when done. */
export function useWriteKitsNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await graphqlClient.request<{ writeKitsNow: number }>(WRITE_KITS_NOW)).writeKitsNow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kitRunKey }),
  });
}

/** Your latest kits run; asks again every few seconds while it is still writing. */
export function useKitRun() {
  return useQuery({
    queryKey: kitRunKey,
    queryFn: async () => (await graphqlClient.request<{ kitRun: KitRun | null }>(KIT_RUN)).kitRun,
    refetchInterval: (query) => (query.state.data?.running ? KIT_RUN_POLL_MS : false),
  });
}

/** Settings > Notifications > Morning briefing: on or off, and its time. */
export function useSetBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { on: boolean; at: string }) =>
      (await graphqlClient.request<{ setBriefing: boolean }>(SET_BRIEFING, { input })).setBriefing,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey }),
  });
}

/** Settings > Notifications > Weekly report: on or off. */
export function useSetWeeklyReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) =>
      (await graphqlClient.request<{ setWeeklyReport: boolean }>(SET_WEEKLY_REPORT, { on }))
        .setWeeklyReport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey }),
  });
}

/** Settings > Gmail: clear emails move jobs by themselves (on) or only suggest (off). */
export function useSetMailAutoStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) =>
      (await graphqlClient.request<{ setMailAutoStatus: boolean }>(SET_MAIL_AUTO_STATUS, { on }))
        .setMailAutoStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey }),
  });
}
