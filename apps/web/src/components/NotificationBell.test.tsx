import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Locale } from '@/i18n/config';
import { closeMessageWindow, useMessageWindowOpen } from '@/lib/message-window';
import { Intl } from '../test/intl';
import { router } from '../test/navigation';
import { bell, keyPool } from '../test/server';
import { NotificationBell } from './NotificationBell';
import { ToastProvider } from './Toasts';

/** Shows whether the message window is open, so a test can see the bell open it. */
function WindowState() {
  return <p>{useMessageWindowOpen() ? 'window open' : 'window closed'}</p>;
}

function renderBell(locale: Locale = 'en', queryClient = createQueryClient()) {
  render(
    <Intl locale={locale}>
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <ToastProvider>
          <WindowState />
          <NotificationBell />
        </ToastProvider>
      </DataProvider>
    </Intl>,
  );
}

const NEW_MATCHES = {
  id: 1,
  kind: 'NEW_MATCHES',
  searchName: 'Frontend Berlin',
  count: 5,
  fitMin: 60,
  at: null,
  refId: null,
  hidden: 0,
  kept: 0,
  undone: false,
  failed: 0,
  reason: null,
  briefing: null,
  weekly: null,
  readAt: null,
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  jobs: [
    { id: 'job-1', title: 'React Developer', company: 'Acme', fit: 82 },
    { id: 'job-2', title: 'Frontend Engineer', company: 'Globex', fit: 71 },
  ],
};

describe('NotificationBell', () => {
  afterEach(() => {
    bell.items = [];
    bell.unread = 0;
  });

  it('shows the unread count, lists new matching jobs with links, and marks them read', async () => {
    bell.items = [NEW_MATCHES];
    bell.unread = 1;
    const user = userEvent.setup();
    renderBell();

    const button = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
    await user.click(button);

    const list = screen.getByRole('dialog', { name: 'Notifications' });
    expect(
      within(list).getByText('5 new jobs fit you from the search “Frontend Berlin”'),
    ).toBeInTheDocument();
    expect(within(list).getByText(/Fit 60% or more · 5 minutes ago/)).toBeInTheDocument();
    expect(
      within(list).getByRole('link', { name: /React Developer.*Acme.*82% fit/ }),
    ).toHaveAttribute('href', '/jobs?job=job-1');
    expect(
      within(list).getByRole('link', { name: '3 more in My Jobs (marked New)' }),
    ).toHaveAttribute('href', '/jobs');
    // Opening the list reads them: the badge goes.
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(bell.unread).toBe(0);
  });

  it('reminds you of an interview, with a link to the job', async () => {
    bell.items = [
      {
        ...NEW_MATCHES,
        id: 2,
        kind: 'INTERVIEW_SOON',
        searchName: '',
        count: 1,
        fitMin: 0,
        at: '2026-11-12T10:00:00.000Z',
        jobs: [{ id: 'job-1', title: 'React Developer', company: 'Acme', fit: 82 }],
      },
    ];
    bell.unread = 1;
    const user = userEvent.setup();
    renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const list = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(list).getByText(/^Interview soon: Thu/)).toBeInTheDocument();
    expect(within(list).getByText(/Open the job to practise/)).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /React Developer.*Acme/ })).toHaveAttribute(
      'href',
      '/jobs?job=job-1',
    );
  });

  it('tells you when an admin answered your message, and opens the message window', async () => {
    bell.items = [
      {
        ...NEW_MATCHES,
        id: 3,
        kind: 'MESSAGE_REPLY',
        searchName: 'Mohamed Faizel',
        count: 1,
        fitMin: 0,
        jobs: [],
      },
    ];
    bell.unread = 1;
    const user = userEvent.setup();
    renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const item = screen.getByRole('button', { name: /Mohamed Faizel replied to your message/ });
    expect(item).toHaveTextContent('Open to read it');
    await user.click(item);
    expect(screen.getByText('window open')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
    act(() => {
      closeMessageWindow();
    });
  });

  it('pops up a toast for an answer that opens the message window', async () => {
    const queryClient = createQueryClient();
    const user = userEvent.setup();
    renderBell('de', queryClient);
    await vi.waitFor(() => {
      expect(queryClient.getQueryData(['notifications'])).toBeDefined();
    });
    bell.items = [
      { ...NEW_MATCHES, id: 4, kind: 'MESSAGE_REPLY', searchName: '', count: 1, jobs: [] },
    ];
    bell.unread = 1;
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Mohamed Faizel hat auf deine Nachricht geantwortet');
    await user.click(within(toast).getByRole('button', { name: 'Anzeigen' }));
    expect(screen.getByText('window open')).toBeInTheDocument();
    act(() => {
      closeMessageWindow();
    });
  });

  it('says so when there is nothing yet, in German too', async () => {
    const user = userEvent.setup();
    renderBell('de');

    await user.click(await screen.findByRole('button', { name: 'Benachrichtigungen' }));

    expect(screen.getByText(/Noch nichts\./)).toBeInTheDocument();
  });

  it('pops up a toast when a notice comes in while the app is open, with a link to the best job', async () => {
    const queryClient = createQueryClient();
    const user = userEvent.setup();
    renderBell('en', queryClient);
    await vi.waitFor(() => {
      expect(queryClient.getQueryData(['notifications'])).toBeDefined();
    });
    // Notices that were there on load don't pop up.
    expect(screen.queryByRole('status')).toBeNull();

    bell.items = [NEW_MATCHES];
    bell.unread = 1;
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('5 new jobs fit you from the search “Frontend Berlin”');
    await user.click(within(toast).getByRole('button', { name: 'Show' }));
    expect(router.push).toHaveBeenCalledWith('/jobs?job=job-1');
  });

  it('closes the list with Escape or a click outside', async () => {
    const user = userEvent.setup();
    renderBell();
    const button = await screen.findByRole('button', { name: 'Notifications' });

    await user.click(button);
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(button);
    await user.click(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says what Autopilot did and undoes it', async () => {
    bell.items = [{ ...NEW_MATCHES, id: 11, kind: 'AUTOPILOT', count: 2, hidden: 4, kept: 3 }];
    bell.unread = 1;
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const list = screen.getByRole('dialog', { name: 'Notifications' });
    expect(
      within(list).getByText('Autopilot for “Frontend Berlin”: 2 jobs queued'),
    ).toBeInTheDocument();
    expect(within(list).getByText(/4 hidden · 3 left for you/)).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /React Developer/ })).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Open Apply queue' })).toHaveAttribute(
      'href',
      '/jobs',
    );

    await user.click(within(list).getByRole('button', { name: 'Undo' }));
    expect(keyPool.sent).toContainEqual({
      operation: 'UndoAutopilot',
      variables: { notificationId: 11 },
    });
    expect(await within(list).findByText('Undone')).toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: /React Developer/ })).toBeNull();
  });

  it('shows the morning briefing', async () => {
    bell.items = [
      {
        ...NEW_MATCHES,
        id: 14,
        kind: 'BRIEFING',
        count: 2,
        briefing: { newJobs: 2, kits: 3, followUps: 0, interviews: 1, replies: 0 },
      },
    ];
    bell.unread = 1;
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const list = screen.getByRole('dialog', { name: 'Notifications' });
    expect(
      within(list).getByText('Good morning: 2 new jobs, 3 kits ready, 1 interview today'),
    ).toBeInTheDocument();
    expect(within(list).getByText(/Your morning briefing/)).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /React Developer/ })).toBeInTheDocument();
  });

  it('shows the weekly report and pauses the search that brings only low Fit', async () => {
    bell.items = [
      {
        ...NEW_MATCHES,
        id: 15,
        kind: 'WEEKLY_REPORT',
        count: 2,
        fitMin: 70,
        weekly: {
          applied: 3,
          replies: 1,
          interviews: 1,
          newJobs: 20,
          goodJobs: 2,
          best: { id: 4, name: 'Frontend Berlin', jobs: 8, good: 2 },
          pause: { id: 7, name: 'Sales', jobs: 12, good: 0, runAt: '06:15' },
        },
      },
    ];
    bell.unread = 1;
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const list = screen.getByRole('dialog', { name: 'Notifications' });
    expect(
      within(list).getByText('Your week: 3 applied, 1 reply, 2 good jobs'),
    ).toBeInTheDocument();
    expect(
      within(list).getByText('Best search: Frontend Berlin (2 good jobs)'),
    ).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /React Developer/ })).toBeInTheDocument();
    expect(
      within(list).getByText('“Sales” brought 12 jobs, none with 70% or more. Pause it?'),
    ).toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: 'Pause' }));
    expect(keyPool.sent).toContainEqual({
      operation: 'SetSavedSearchSchedule',
      variables: { id: 7, input: { schedule: 'OFF', runAt: '06:15' } },
    });
    expect(await within(list).findByText(/Paused\. You can turn it back on/)).toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('shows a weekly report with no search to name, in German', async () => {
    bell.items = [
      {
        ...NEW_MATCHES,
        id: 16,
        kind: 'WEEKLY_REPORT',
        count: 0,
        jobs: [],
        weekly: {
          applied: 1,
          replies: 0,
          interviews: 0,
          newJobs: 4,
          goodJobs: 0,
          best: null,
          pause: { id: 7, name: 'Sales', jobs: 5, good: 0, runAt: null },
        },
      },
    ];
    bell.unread = 1;
    const user = userEvent.setup();
    renderBell('de');
    await user.click(await screen.findByRole('button', { name: /Benachrichtigungen/ }));
    expect(
      screen.getByText('Deine Woche: 1 beworben, 0 Antworten, 0 gute Jobs'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Beste Suche/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Pausieren' }));
    expect(keyPool.sent).toContainEqual({
      operation: 'SetSavedSearchSchedule',
      variables: { id: 7, input: { schedule: 'OFF', runAt: '07:00' } },
    });
  });

  it('says apply kits are ready, or why none were written', async () => {
    bell.items = [
      { ...NEW_MATCHES, id: 12, kind: 'KITS_READY', count: 2, failed: 1 },
      { ...NEW_MATCHES, id: 13, kind: 'KITS_FAILED', count: 0, jobs: [], reason: 'NO_KEY' },
    ];
    bell.unread = 2;
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    const list = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(list).getByText('2 apply kits are ready to check')).toBeInTheDocument();
    expect(within(list).getByText(/1 kit could not be written/)).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /React Developer/ })).toBeInTheDocument();
    expect(within(list).getByText('Apply kits were not written')).toBeInTheDocument();
    expect(within(list).getByText(/Add your Claude or OpenAI key/)).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Open Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('lets an admin approve a token request from the bell', async () => {
    bell.items = [
      {
        ...NEW_MATCHES,
        id: 9,
        kind: 'KEY_REQUEST',
        searchName: 'Cara Weber',
        count: 7,
        refId: 42,
        jobs: [],
      },
    ];
    bell.unread = 1;
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const list = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(list).getByText('Cara Weber asks for a JobHunter token')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Open Key pool' })).toHaveAttribute(
      'href',
      '/admin?tab=keys',
    );
    await user.click(within(list).getByRole('button', { name: 'Approve: give the next free key' }));
    expect(keyPool.sent).toContainEqual({ operation: 'ApproveKeyRequest', variables: { id: 42 } });
    expect(await within(list).findByText(/Answered/)).toBeInTheDocument();
  });

  it('says no to a token request from the bell', async () => {
    bell.items = [
      {
        ...NEW_MATCHES,
        id: 9,
        kind: 'KEY_REQUEST',
        searchName: 'Cara',
        count: 7,
        refId: 42,
        jobs: [],
      },
    ];
    bell.unread = 1;
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const list = screen.getByRole('dialog', { name: 'Notifications' });
    await user.click(within(list).getByRole('button', { name: 'Deny' }));
    expect(keyPool.sent).toContainEqual({
      operation: 'DenyKeyRequest',
      variables: { input: { id: 42 } },
    });
    await user.click(within(list).getByRole('link', { name: 'Open Key pool' }));
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('tells a user their token was approved, with the limit', async () => {
    bell.items = [{ ...NEW_MATCHES, id: 10, kind: 'KEY_APPROVED', count: 500, jobs: [] }];
    bell.unread = 1;
    const user = userEvent.setup();
    renderBell('de');
    await user.click(await screen.findByRole('button', { name: /Benachrichtigungen/ }));
    expect(
      screen.getByText(/Token-Anfrage freigegeben.*Limit von 500 Credits/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Einstellungen öffnen' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });
});
