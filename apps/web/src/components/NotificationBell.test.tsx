import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Locale } from '@/i18n/config';
import { Intl } from '../test/intl';
import { router } from '../test/navigation';
import { bell } from '../test/server';
import { NotificationBell } from './NotificationBell';
import { ToastProvider } from './Toasts';

function renderBell(locale: Locale = 'en', queryClient = createQueryClient()) {
  render(
    <Intl locale={locale}>
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <ToastProvider>
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
      within(list).getByRole('link', { name: '3 more in Job posts (marked New)' }),
    ).toHaveAttribute('href', '/jobs');
    // Opening the list reads them: the badge goes.
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(bell.unread).toBe(0);
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
});
