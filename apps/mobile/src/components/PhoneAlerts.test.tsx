import { createQueryClient } from '@jobsearch/data';
import { act, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { fakeApi, notification, user } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { PhoneAlerts } from './PhoneAlerts';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockTapped = { current: null as unknown };
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  setBadgeCountAsync: jest.fn(() => Promise.resolve(true)),
  useLastNotificationResponse: () => mockTapped.current,
}));

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockTapped.current = null;
  Platform.OS = 'ios';
});

/** The fake API: the 🔔 list grows with `later` from the second ask on. */
function api(later: ReturnType<typeof notification>[] = []) {
  let asks = 0;
  const first = [notification({ id: 1, searchName: 'Old search' })];
  return fakeApi({
    Me: () => ({ data: { me: user } }),
    Notifications: () => {
      asks += 1;
      const items = asks === 1 ? first : [...later, ...first];
      return { data: { notifications: { items, unread: items.length } } };
    },
  });
}

describe('PhoneAlerts', () => {
  it('pops up only notifications that come in while the app is open', async () => {
    const client = createQueryClient();
    api([
      notification({ id: 2 }),
      notification({
        id: 3,
        kind: 'INTERVIEW_SOON',
        at: '2026-11-10T09:30:00.000Z',
        jobs: [{ id: '7', title: 'ML Engineer', company: 'N26', fit: 70 }],
      }),
      notification({ id: 4, kind: 'MESSAGE_REPLY', searchName: 'Sam', jobs: [] }),
    ]);
    await renderApp(<PhoneAlerts />, client);
    await waitFor(() => {
      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(1);
    });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    // What was there when the app opened is only in the 🔔.
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    await act(() => client.refetchQueries({ queryKey: ['notifications'] }));
    await waitFor(() => {
      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(4);
    });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: '1 new job fits you from the search “Data jobs”',
        body: 'Data Engineer · HelloFresh · 82%',
        data: { url: '/alerts' },
      },
      trigger: null,
    });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: 'ML Engineer · N26',
          data: { url: '/job/7' },
        }) as unknown,
      }),
    );

    // An answer to your message opens the message window.
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: {
          title: 'Sam replied to your message',
          body: 'Open to read it',
          data: { url: '/messages' },
        },
      }),
    );

    // The next ask has nothing new: no second pop-up for the same notification.
    await act(() => client.refetchQueries({ queryKey: ['notifications'] }));
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
  });

  it('uses its own channel on Android', async () => {
    Platform.OS = 'android';
    const client = createQueryClient();
    api([notification({ id: 2 })]);
    await renderApp(<PhoneAlerts />, client);
    await waitFor(() => {
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('alerts', {
        name: 'New jobs and interviews',
        importance: 4,
      });
    });
    await waitFor(() => {
      expect(Notifications.setBadgeCountAsync).toHaveBeenCalled();
    });
    await act(() => client.refetchQueries({ queryKey: ['notifications'] }));
    await waitFor(() => {
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: { channelId: 'alerts' } }),
      );
    });
  });

  it('opens what you tapped', async () => {
    mockTapped.current = { notification: { request: { content: { data: { url: '/job/7' } } } } };
    api();
    await renderApp(<PhoneAlerts />);
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/job/7');
    });
  });

  it('does nothing in a browser', async () => {
    Platform.OS = 'web';
    api();
    await renderApp(<PhoneAlerts />);
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });
});
