import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import {
  ADMIN_OVERVIEW,
  ADMIN_USERS,
  APP_SETTINGS,
  CANCEL_INVITE,
  CREATE_INVITE,
  DELETE_USER,
  INVITES,
  SET_USER_DISABLED,
  SET_USER_ROLE,
  SIGNUP_STATE,
  UPDATE_APP_SETTINGS,
} from './operations';
import type {
  AdminOverview,
  AdminUser,
  AppSettings,
  AppSettingsChange,
  Invite,
  Role,
  SignupState,
} from './types';

export const adminUsersKey = ['admin', 'users'] as const;

/** Every account, oldest first. Admins only: anyone else gets ADMIN_ONLY. */
export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: adminUsersKey,
    queryFn: async () =>
      (await graphqlClient.request<{ adminUsers: AdminUser[] }>(ADMIN_USERS)).adminUsers,
    enabled,
  });
}

/** Puts the changed account in the list right away, then reads the list again. */
function useAccountChange<Input>(run: (input: Input) => Promise<AdminUser>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async (changed) => {
      queryClient.setQueryData<AdminUser[]>(adminUsersKey, (users) =>
        users?.map((user) => (user.id === changed.id ? changed : user)),
      );
      await queryClient.invalidateQueries({ queryKey: adminUsersKey });
    },
  });
}

/** Makes an account admin, or a normal user again. */
export function useSetUserRole() {
  return useAccountChange(
    async (input: { userId: number; role: Role }) =>
      (await graphqlClient.request<{ setUserRole: AdminUser }>(SET_USER_ROLE, { input }))
        .setUserRole,
  );
}

/** Switches an account off (it can't log in) or on again. */
export function useSetUserDisabled() {
  return useAccountChange(
    async (input: { userId: number; disabled: boolean }) =>
      (await graphqlClient.request<{ setUserDisabled: AdminUser }>(SET_USER_DISABLED, { input }))
        .setUserDisabled,
  );
}

/** Deletes an account and all its data. `confirmEmail` is its email, typed again. */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: number; confirmEmail: string }) => {
      await graphqlClient.request(DELETE_USER, { input });
      return input.userId;
    },
    onSuccess: async (userId) => {
      queryClient.setQueryData<AdminUser[]>(adminUsersKey, (users) =>
        users?.filter((user) => user.id !== userId),
      );
      await queryClient.invalidateQueries({ queryKey: adminUsersKey });
    },
  });
}

export const appSettingsKey = ['admin', 'settings'] as const;
export const invitesKey = ['admin', 'invites'] as const;

/** Sign-up mode and limits (admins only). */
export function useAppSettings() {
  return useQuery({
    queryKey: appSettingsKey,
    queryFn: async () =>
      (await graphqlClient.request<{ appSettings: AppSettings }>(APP_SETTINGS)).appSettings,
  });
}

/** Saves the changed settings; they work at once on the server. */
export function useUpdateAppSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AppSettingsChange) =>
      (
        await graphqlClient.request<{ updateAppSettings: AppSettings }>(UPDATE_APP_SETTINGS, {
          input,
        })
      ).updateAppSettings,
    onSuccess: async (settings) => {
      queryClient.setQueryData(appSettingsKey, settings);
      // Admin › Key pool shows the pool's switch and limit too.
      await queryClient.invalidateQueries({ queryKey: ['admin', 'keyPool'] });
    },
  });
}

/** Invite links not canceled, newest first. */
export function useInvites() {
  return useQuery({
    queryKey: invitesKey,
    queryFn: async () => (await graphqlClient.request<{ invites: Invite[] }>(INVITES)).invites,
  });
}

/** Makes an invite link. Null = never expires / any number of times. */
export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { expiresInDays: number | null; maxUses: number | null }) =>
      (await graphqlClient.request<{ createInvite: Invite }>(CREATE_INVITE, { input }))
        .createInvite,
    onSuccess: (invite) => {
      queryClient.setQueryData<Invite[]>(invitesKey, (list) => [invite, ...(list ?? [])]);
    },
  });
}

export function useCancelInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await graphqlClient.request(CANCEL_INVITE, { id });
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Invite[]>(invitesKey, (list) => list?.filter((i) => i.id !== id));
    },
  });
}

/** For the sign-up page: can it make an account, with this invite code or none? */
export function useSignupState(invite: string | null, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['signupState', invite],
    queryFn: async () =>
      (
        await graphqlClient.request<{ signupState: SignupState }>(SIGNUP_STATE, {
          invite: invite ?? null,
        })
      ).signupState,
  });
}

export const adminOverviewKey = ['admin', 'overview'] as const;

/** Admin › Overview. Each fetch checks the server's parts again. */
export function useAdminOverview() {
  return useQuery({
    queryKey: adminOverviewKey,
    queryFn: async () =>
      (await graphqlClient.request<{ adminOverview: AdminOverview }>(ADMIN_OVERVIEW)).adminOverview,
  });
}
