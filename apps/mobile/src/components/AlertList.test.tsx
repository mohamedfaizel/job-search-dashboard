import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeApi, notification, user } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { AlertList } from './AlertList';
import { BellButton } from './BellButton';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

afterEach(() => {
  jest.restoreAllMocks();
});

const items = [
  notification({
    id: 2,
    count: 4,
    jobs: [
      { id: '5', title: 'Data Engineer', company: 'HelloFresh', fit: 82 },
      { id: '6', title: 'BI Analyst', company: 'Zalando', fit: 64 },
    ],
  }),
  notification({
    id: 1,
    kind: 'INTERVIEW_SOON',
    at: '2026-11-10T09:30:00.000Z',
    jobs: [{ id: '7', title: 'ML Engineer', company: 'N26', fit: 70 }],
    readAt: '2026-11-08T10:00:00.000Z',
  }),
];

function api(list = items) {
  return fakeApi({
    Me: () => ({ data: { me: user } }),
    Notifications: () => ({
      data: {
        notifications: {
          items: list,
          unread: list.filter((item) => item.readAt === null).length,
        },
      },
    }),
    MarkNotificationsRead: () => ({ data: { markNotificationsRead: 1 } }),
  });
}

describe('AlertList', () => {
  it('shows new jobs and interview reminders, marks them read, and opens a job', async () => {
    const calls = api();
    await renderApp(<AlertList />);
    expect(
      await screen.findByText('4 new jobs fit you from the search “Data jobs”'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Fit 82%')).toBeOnTheScreen();
    expect(screen.getByText('Zalando')).toBeOnTheScreen();
    expect(screen.getByText('2 more in the job list (marked New)')).toBeOnTheScreen();
    expect(screen.getByText(/^Interview soon: /)).toBeOnTheScreen();
    expect(screen.getByText('Practise on the website’s Interview tab.')).toBeOnTheScreen();
    // Only the new one has the red dot.
    expect(screen.getAllByLabelText('unread')).toHaveLength(1);
    await waitFor(() => {
      expect(calls.map((call) => call.operation)).toContain('MarkNotificationsRead');
    });

    await fireEvent.press(screen.getByText('BI Analyst'));
    expect(router.push).toHaveBeenCalledWith('/job/6');
  });

  it('shows Key pool news in one line', async () => {
    api([notification({ id: 3, kind: 'KEY_APPROVED', count: 500, jobs: [] })]);
    await renderApp(<AlertList />);
    expect(
      await screen.findByText(
        'Token request approved. It is already set in your Settings, with a limit of 500 credits.',
      ),
    ).toBeOnTheScreen();
  });

  it('says when there is nothing yet, without marking anything read', async () => {
    const calls = api([]);
    await renderApp(<AlertList />);
    expect(await screen.findByText(/^Nothing yet\./)).toBeOnTheScreen();
    expect(calls.map((call) => call.operation)).not.toContain('MarkNotificationsRead');
  });

  it('shows why the list could not load', async () => {
    fakeApi({ Me: () => ({ data: { me: user } }) });
    await renderApp(<AlertList />);
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      /No fake for Notifications/,
    );
  });
});

describe('BellButton', () => {
  it('shows the unread count and opens the list', async () => {
    api();
    await renderApp(<BellButton />);
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
    expect(screen.getByText('1')).toBeOnTheScreen();
    await fireEvent.press(bell);
    expect(router.push).toHaveBeenCalledWith('/alerts');
  });

  it('has no count when everything is read', async () => {
    api([]);
    await renderApp(<BellButton />);
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeOnTheScreen();
  });
});
