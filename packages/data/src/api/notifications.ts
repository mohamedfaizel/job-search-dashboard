import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import {
  MARK_NOTIFICATIONS_READ,
  NOTIFICATIONS,
  REGISTER_PUSH_TOKEN,
  UNDO_AUTOPILOT,
  UNDO_MAIL_AUTO,
  UNREGISTER_PUSH_TOKEN,
} from './operations';
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

/** Undo in the bell: an Autopilot run's jobs leave the queue and show on Job posts again. */
export function useUndoAutopilot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: number) => {
      const data = await graphqlClient.request<{ undoAutopilot: boolean }>(UNDO_AUTOPILOT, {
        notificationId,
      });
      return data.undoAutopilot;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: notificationsKey }),
        queryClient.invalidateQueries({ queryKey: ['jobs'] }),
      ]);
    },
  });
}

/** The phone app: this phone gets push messages (the morning briefing) for you. */
export async function registerPushToken(token: string): Promise<boolean> {
  const data = await graphqlClient.request<{ registerPushToken: boolean }>(REGISTER_PUSH_TOKEN, {
    token,
  });
  return data.registerPushToken;
}

/** The phone app on log out: no more pushes to this phone. */
export async function unregisterPushToken(token: string): Promise<boolean> {
  const data = await graphqlClient.request<{ unregisterPushToken: boolean }>(
    UNREGISTER_PUSH_TOKEN,
    { token },
  );
  return data.unregisterPushToken;
}

/** Undo in the bell: the jobs clear emails moved go back to where they were. */
export function useUndoMailAuto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: number) =>
      (await graphqlClient.request<{ undoMailAuto: boolean }>(UNDO_MAIL_AUTO, { notificationId }))
        .undoMailAuto,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: notificationsKey }),
        queryClient.invalidateQueries({ queryKey: ['jobs'] }),
      ]);
    },
  });
}
