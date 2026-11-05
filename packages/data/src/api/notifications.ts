import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { MARK_NOTIFICATIONS_READ, NOTIFICATIONS } from './operations';
import type { Notifications } from './types';

export const notificationsKey = ['notifications'] as const;

/** How often the bell asks for new notifications (scheduled searches run at most every minute). */
export const NOTIFICATIONS_POLL_MS = 60_000;

export async function fetchNotifications(): Promise<Notifications> {
  const data = await graphqlClient.request<{ notifications: Notifications }>(NOTIFICATIONS);
  return data.notifications;
}

/** Marks all your notifications read. Returns how many were unread. */
export async function markNotificationsRead(): Promise<number> {
  const data = await graphqlClient.request<{ markNotificationsRead: number }>(
    MARK_NOTIFICATIONS_READ,
  );
  return data.markNotificationsRead;
}

/** The bell list with everything read at `now`, for the cache while the save runs. */
export function allRead(list: Notifications, now: string): Notifications {
  return { unread: 0, items: list.items.map((item) => ({ ...item, readAt: item.readAt ?? now })) };
}

/** Your bell list and unread count, asked again every minute while the app is open. */
export function useNotifications(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: fetchNotifications,
    enabled: options.enabled ?? true,
    refetchInterval: NOTIFICATIONS_POLL_MS,
  });
}

/** Marks all your notifications read: the bell's badge goes away at once. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onMutate: () => {
      const before = queryClient.getQueryData<Notifications>(notificationsKey);
      if (before) {
        queryClient.setQueryData(notificationsKey, allRead(before, new Date().toISOString()));
      }
    },
  });
}
