import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { MARK_NOTIFICATIONS_READ, NOTIFICATIONS } from './operations';
import type { Notifications } from './types';

export const notificationsKey = ['notifications'] as const;

/** How often the bell asks for new notifications (scheduled searches run at most every minute). */
export const NOTIFICATIONS_POLL_MS = 60_000;

/** Your bell list and unread count, asked again every minute while the app is open. */
export function useNotifications(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: async () => {
      const data = await graphqlClient.request<{ notifications: Notifications }>(NOTIFICATIONS);
      return data.notifications;
    },
    enabled: options.enabled ?? true,
    refetchInterval: NOTIFICATIONS_POLL_MS,
  });
}

/** Marks all your notifications read: the bell's badge goes away at once. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const data = await graphqlClient.request<{ markNotificationsRead: number }>(
        MARK_NOTIFICATIONS_READ,
      );
      return data.markNotificationsRead;
    },
    onMutate: () => {
      const before = queryClient.getQueryData<Notifications>(notificationsKey);
      if (before) {
        const now = new Date().toISOString();
        queryClient.setQueryData<Notifications>(notificationsKey, {
          unread: 0,
          items: before.items.map((item) => ({ ...item, readAt: item.readAt ?? now })),
        });
      }
    },
  });
}
