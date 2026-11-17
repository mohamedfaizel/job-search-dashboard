import type { AdminUser } from '@jobsearch/data';
import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { Intl } from '@/test/intl';
import { ADMIN, api, server, session } from '@/test/server';
import { AdminPage } from './AdminPage';

const NOW = new Date().toISOString();

function account(over: Partial<AdminUser>): AdminUser {
  return {
    id: 1,
    name: 'Mohamed',
    email: 'mohamed@example.com',
    role: 'ADMIN',
    joinedAt: '2026-10-01T10:00:00.000Z',
    lastSeenAt: NOW,
    disabled: false,
    hasJobKey: true,
    importsThisMonth: 4,
    ...over,
  };
}

let users: AdminUser[] = [];
const sent: { operation: string; input: Record<string, unknown> }[] = [];

function change(operation: string, id: number, patch: Partial<AdminUser>) {
  users = users.map((u) => (u.id === id ? { ...u, ...patch } : u));
  return { [operation]: users.find((u) => u.id === id) };
}

beforeEach(() => {
  sent.length = 0;
  users = [
    account({}),
    account({ id: 2, name: 'Sara Klein', email: 'sara@mail.de', role: 'USER', lastSeenAt: null }),
    account({
      id: 3,
      name: 'Tom Becker',
      email: 'tom@posteo.de',
      role: 'USER',
      disabled: true,
      hasJobKey: false,
      importsThisMonth: 0,
    }),
  ];
  server.use(
    api.query('AdminOverview', () => HttpResponse.json({ data: { adminOverview: null } })),
    api.query('AdminUsers', () => HttpResponse.json({ data: { adminUsers: users } })),
    api.mutation('SetUserRole', ({ variables }) => {
      const input = variables['input'] as { userId: number; role: 'ADMIN' | 'USER' };
      sent.push({ operation: 'SetUserRole', input });
      return HttpResponse.json({ data: change('setUserRole', input.userId, { role: input.role }) });
    }),
    api.mutation('SetUserDisabled', ({ variables }) => {
      const input = variables['input'] as { userId: number; disabled: boolean };
      sent.push({ operation: 'SetUserDisabled', input });
      return HttpResponse.json({
        data: change('setUserDisabled', input.userId, { disabled: input.disabled }),
      });
    }),
    api.mutation('DeleteUser', ({ variables }) => {
      const input = variables['input'] as { userId: number; confirmEmail: string };
      sent.push({ operation: 'DeleteUser', input });
      users = users.filter((u) => u.id !== input.userId);
      return HttpResponse.json({ data: { deleteUser: input.userId } });
    }),
  );
});

/** Opens the Admin page on its Users tab (Overview comes first). */
async function renderPage() {
  renderAsIs();
  fireEvent.click(await screen.findByRole('tab', { name: 'Users' }));
}

function renderAsIs() {
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

/** The wide-screen table (the phone cards show the same accounts). */
const table = async () => within(await screen.findByRole('table'));
const rowOf = async (name: string) =>
  within((await table()).getByText(name).closest('tr') as HTMLElement);

describe('AdminPage', () => {
  it('lists every account with counts, and no buttons on your own', async () => {
    session.user = ADMIN;
    await renderPage();

    expect(await screen.findByRole('heading', { name: 'Users (3)' })).toBeInTheDocument();
    const me = await rowOf('Mohamed');
    expect(me.getByText('You')).toBeInTheDocument();
    expect(me.queryByRole('button')).toBeNull();

    const sara = await rowOf('Sara Klein');
    expect(sara.getByText('Never')).toBeInTheDocument();
    expect(sara.getByRole('img', { name: 'Has a job data key' })).toBeInTheDocument();
    const tom = await rowOf('Tom Becker');
    expect(tom.getByText('Switched off')).toBeInTheDocument();
    expect(tom.getByRole('img', { name: 'No job data key' })).toBeInTheDocument();
  });

  it('finds users by name or email and by filter', async () => {
    session.user = ADMIN;
    const user = userEvent.setup();
    await renderPage();
    await table();

    await user.type(screen.getByRole('searchbox', { name: 'Find a user' }), 'POSTEO');
    expect((await table()).queryByText('Sara Klein')).toBeNull();
    expect((await table()).getByText('Tom Becker')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Find a user' }));
    await user.click(screen.getByRole('button', { name: 'Admins' }));
    expect(screen.getByRole('button', { name: 'Admins' })).toHaveAttribute('aria-pressed', 'true');
    expect((await table()).queryByText('Sara Klein')).toBeNull();
    expect((await table()).getByText('Mohamed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'No key' }));
    await user.type(screen.getByRole('searchbox', { name: 'Find a user' }), 'nobody');
    expect(screen.getByText('No user matches.')).toBeInTheDocument();
  });

  it('makes a user admin, switches one on, and switches one off', async () => {
    session.user = ADMIN;
    const user = userEvent.setup();
    await renderPage();

    await user.click((await rowOf('Sara Klein')).getByRole('button', { name: 'Make admin' }));
    expect(
      await (await rowOf('Sara Klein')).findByRole('button', { name: 'Remove admin' }),
    ).toBeInTheDocument();

    await user.click((await rowOf('Tom Becker')).getByRole('button', { name: 'Switch on' }));
    expect(
      await (await rowOf('Tom Becker')).findByRole('button', { name: 'Make admin' }),
    ).toBeInTheDocument();

    const sara = await rowOf('Sara Klein');
    await user.click(sara.getByRole('button', { name: 'More for Sara Klein' }));
    await user.click(sara.getByRole('button', { name: 'Switch off' }));
    expect(await (await rowOf('Sara Klein')).findByText('Switched off')).toBeInTheDocument();

    expect(sent).toEqual([
      { operation: 'SetUserRole', input: { userId: 2, role: 'ADMIN' } },
      { operation: 'SetUserDisabled', input: { userId: 3, disabled: false } },
      { operation: 'SetUserDisabled', input: { userId: 2, disabled: true } },
    ]);
  });

  it('deletes an account only after its email is typed again', async () => {
    session.user = ADMIN;
    const user = userEvent.setup();
    await renderPage();

    const sara = await rowOf('Sara Klein');
    await user.click(sara.getByRole('button', { name: 'More for Sara Klein' }));
    await user.click(sara.getByRole('button', { name: 'Delete' }));

    const dialog = within(screen.getByRole('dialog', { name: 'Delete Sara Klein?' }));
    const go = dialog.getByRole('button', { name: 'Delete for good' });
    const email = dialog.getByRole('textbox', { name: 'Type their email to confirm' });
    expect(email).toHaveFocus();
    await user.type(email, 'sara@');
    expect(go).toBeDisabled();
    await user.type(email, 'mail.de');
    await user.click(go);

    expect(await screen.findByRole('heading', { name: 'Users (2)' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent).toEqual([
      { operation: 'DeleteUser', input: { userId: 2, confirmEmail: 'sara@mail.de' } },
    ]);
  });

  it('shows a normal user only a short note, without asking for the list', async () => {
    session.user = { ...ADMIN, id: 2, role: 'USER' };
    renderAsIs();

    expect(await screen.findByText('Only admins can open this page.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
