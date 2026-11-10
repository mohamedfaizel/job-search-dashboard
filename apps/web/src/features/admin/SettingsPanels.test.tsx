import type { AppSettings, Invite } from '@jobsearch/data';
import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { Intl } from '@/test/intl';
import { ADMIN, api, server, session } from '@/test/server';
import { AdminPage } from './AdminPage';

let settings: AppSettings;
let invites: Invite[];
const sent: { operation: string; input: unknown }[] = [];

beforeEach(() => {
  sent.length = 0;
  session.user = ADMIN;
  settings = {
    signupMode: 'OPEN',
    dailyCreditCap: 100,
    maxSavedSearches: 10,
    schedulerOn: true,
    stillOpenOn: true,
    schedulerOffInEnv: false,
    stillOpenOffInEnv: true,
  };
  invites = [
    {
      id: 1,
      token: 'Mx91abcdef',
      createdAt: '2026-11-08T10:00:00.000Z',
      expiresAt: null,
      maxUses: 10,
      uses: 3,
      state: 'ACTIVE',
    },
  ];
  server.use(
    api.query('AdminUsers', () => HttpResponse.json({ data: { adminUsers: [] } })),
    api.query('AppSettings', () => HttpResponse.json({ data: { appSettings: settings } })),
    api.mutation('UpdateAppSettings', ({ variables }) => {
      sent.push({ operation: 'UpdateAppSettings', input: variables['input'] });
      settings = { ...settings, ...(variables['input'] as Partial<AppSettings>) };
      return HttpResponse.json({ data: { updateAppSettings: settings } });
    }),
    api.query('Invites', () => HttpResponse.json({ data: { invites } })),
    api.mutation('CreateInvite', ({ variables }) => {
      sent.push({ operation: 'CreateInvite', input: variables['input'] });
      const made: Invite = {
        id: 2,
        token: 'k7Q2xyz',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        maxUses: 1,
        uses: 0,
        state: 'ACTIVE',
      };
      invites = [made, ...invites];
      return HttpResponse.json({ data: { createInvite: made } });
    }),
    api.mutation('CancelInvite', ({ variables }) => {
      sent.push({ operation: 'CancelInvite', input: variables['id'] });
      invites = invites.filter((i) => i.id !== variables['id']);
      return HttpResponse.json({ data: { cancelInvite: variables['id'] } });
    }),
  );
});

function renderPage() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <Intl locale="en">
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <AdminPage />
      </DataProvider>
    </Intl>,
  );
}

describe('Admin › Sign-up & access', () => {
  it('switches sign-up to invite only, and makes, copies and cancels invite links', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Sign-up & access' }));
    expect(await screen.findByRole('radio', { name: /Open to everyone/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /Invite only/ }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Invite only/ })).toBeChecked();

    expect(await screen.findByText('3 of 10')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Can be used' }), 'Once');
    await user.click(screen.getByRole('button', { name: '+ New invite link' }));
    const made = await screen.findByRole('button', { name: 'Copy link k7Q2…' });
    await user.click(made);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/signup?invite=k7Q2xyz`);
    expect(made).toHaveTextContent('Copied');

    await user.click(screen.getByRole('button', { name: 'Cancel link Mx91…' }));
    expect(await screen.findByText('0 of 1')).toBeInTheDocument();
    expect(screen.queryByText('3 of 10')).toBeNull();
    expect(sent).toEqual([
      { operation: 'UpdateAppSettings', input: { signupMode: 'INVITE' } },
      { operation: 'CreateInvite', input: { expiresInDays: 7, maxUses: 1 } },
      { operation: 'CancelInvite', input: 1 },
    ]);
  });
});

describe('Admin › Limits', () => {
  it('saves a number when you leave the box, and a switch at once', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Limits' }));

    const cap = await screen.findByRole('spinbutton', { name: /most credits a day/ });
    await user.clear(cap);
    await user.type(cap, '40');
    await user.tab();
    expect(await screen.findByText('Saved.')).toBeInTheDocument();

    // A value out of range goes back to the saved one, without a save.
    const max = screen.getByRole('spinbutton', { name: 'Most saved searches per user' });
    await user.clear(max);
    await user.type(max, '0');
    await user.tab();
    expect(max).toHaveValue(10);

    const scheduler = screen.getByRole('switch', { name: 'Run scheduled searches' });
    expect(scheduler).toBeChecked();
    await user.click(scheduler);
    await vi.waitFor(() => {
      expect(scheduler).not.toBeChecked();
    });

    // .env keeps the nightly check off: the switch says so and can't be turned on here.
    const stillOpen = screen.getByRole('switch', { name: /still open/ });
    expect(stillOpen).not.toBeChecked();
    expect(stillOpen).toBeDisabled();
    expect(stillOpen).toHaveAccessibleDescription(/Switched off in the server’s .env file/);

    expect(sent).toEqual([
      { operation: 'UpdateAppSettings', input: { dailyCreditCap: 40 } },
      { operation: 'UpdateAppSettings', input: { schedulerOn: false } },
    ]);
  });

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    renderPage();
    const users = await screen.findByRole('tab', { name: 'Users' });
    users.focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Limits' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Limits' })).toHaveFocus();
    expect(
      within(screen.getByRole('tabpanel')).getByText(/Changes save on their own/),
    ).toBeInTheDocument();
  });
});
