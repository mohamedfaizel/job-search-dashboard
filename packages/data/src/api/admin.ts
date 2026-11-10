import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { ADMIN_USERS, DELETE_USER, SET_USER_DISABLED, SET_USER_ROLE } from './operations';
import type { AdminUser, Role } from './types';

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
