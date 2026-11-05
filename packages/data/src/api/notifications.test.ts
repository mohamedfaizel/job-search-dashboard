import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphqlClient } from './client';
import { allRead, fetchNotifications, markNotificationsRead } from './notifications';
import type { AppNotification } from './types';

const notice = (id: number, readAt: string | null): AppNotification => ({
  id,
  kind: 'NEW_MATCHES',
  searchName: 'Frontend',
  count: 2,
  fitMin: 60,
  jobs: [],
  readAt,
  createdAt: '2026-11-05T10:00:00.000Z',
});

describe('notifications', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks the API for the bell list', async () => {
    const list = { items: [notice(1, null)], unread: 1 };
    const request = vi.spyOn(graphqlClient, 'request').mockResolvedValue({ notifications: list });

    await expect(fetchNotifications()).resolves.toEqual(list);
    expect(request).toHaveBeenCalledWith(expect.stringContaining('query Notifications'));
  });

  it('marks them read and answers how many were unread', async () => {
    vi.spyOn(graphqlClient, 'request').mockResolvedValue({ markNotificationsRead: 3 });
    await expect(markNotificationsRead()).resolves.toBe(3);
  });

  it('reads every unread one at once, keeping when the others were read', () => {
    const list = { items: [notice(1, null), notice(2, '2026-11-04T09:00:00.000Z')], unread: 1 };

    expect(allRead(list, '2026-11-05T12:00:00.000Z')).toEqual({
      unread: 0,
      items: [
        { ...notice(1, null), readAt: '2026-11-05T12:00:00.000Z' },
        notice(2, '2026-11-04T09:00:00.000Z'),
      ],
    });
  });
});
