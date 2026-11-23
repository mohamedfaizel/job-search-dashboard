import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { Intl } from '@/test/intl';
import { api, keyPool, server } from '@/test/server';
import { KeyPoolPanel } from './components/KeyPoolPanel';

function renderPanel() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <Intl locale="en">
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <KeyPoolPanel />
      </DataProvider>
    </Intl>,
  );
}

beforeEach(() => {
  keyPool.pool = {
    free: 1,
    assigned: 1,
    empty: 0,
    limit: 500,
    autoApprove: true,
    keys: [
      {
        id: 2,
        status: 'ASSIGNED',
        holder: 'Lena K.',
        used: 500,
        credits: 640,
        note: 'Seeker plan',
        createdAt: '2026-11-20T10:00:00.000Z',
      },
      {
        id: 1,
        status: 'FREE',
        holder: null,
        used: 0,
        credits: null,
        note: '',
        createdAt: '2026-11-20T10:00:00.000Z',
      },
    ],
    requests: [
      { id: 7, name: 'Cara Weber', email: 'cara@example.com', createdAt: new Date().toISOString() },
    ],
  };
});

describe('Admin › Key pool', () => {
  it('shows counts and keys by number only, with the limit reached', async () => {
    renderPanel();
    expect(await screen.findByText('Requests waiting')).toBeVisible();
    expect(screen.getByText('Key #2')).toBeVisible();
    expect(screen.getByText('Lena K.')).toBeVisible();
    expect(screen.getByText('500 / 500')).toBeVisible();
    expect(screen.getByText('Limit reached')).toBeVisible();
  });

  it('approves a request with ✓ and says no with an optional note', async () => {
    const user = userEvent.setup();
    renderPanel();
    const row = within((await screen.findByText('Cara Weber')).closest('li') as HTMLElement);
    await user.click(row.getByRole('button', { name: 'Approve: give the next free key' }));
    expect(keyPool.sent).toContainEqual({ operation: 'ApproveKeyRequest', variables: { id: 7 } });

    await user.click(row.getByRole('button', { name: 'Deny (optional note)' }));
    await user.type(row.getByLabelText('Note for the user (optional)'), 'Try later');
    await user.click(row.getByRole('button', { name: 'Deny' }));
    expect(keyPool.sent).toContainEqual({
      operation: 'DenyKeyRequest',
      variables: { input: { id: 7, note: 'Try later' } },
    });
  });

  it('adds pasted keys from one compact row, shown as dots', async () => {
    const user = userEvent.setup();
    renderPanel();
    const box = await screen.findByLabelText('Paste one or many keys');
    expect(box).toHaveAttribute('type', 'password');
    await user.type(box, 'jp_a_1111 jp_b_2222');
    await user.click(screen.getByRole('button', { name: 'Add to pool' }));
    expect(keyPool.sent).toContainEqual({
      operation: 'AddPoolKeys',
      variables: { input: { keys: 'jp_a_1111 jp_b_2222', note: '' } },
    });
    expect(await screen.findByText('✓ 2 added · 1 duplicate · 0 not valid')).toBeVisible();
  });

  it('takes a key back or passes it on', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Give to the next waiting user' }));
    expect(keyPool.sent).toContainEqual({
      operation: 'TakeBackPoolKey',
      variables: { id: 2, passOn: true },
    });
    await user.click(screen.getByRole('button', { name: 'Take back (user loses it)' }));
    expect(keyPool.sent).toContainEqual({
      operation: 'TakeBackPoolKey',
      variables: { id: 2, passOn: false },
    });
  });
  it('switches auto-approve and saves a new limit, but not a wrong one', async () => {
    const settings: unknown[] = [];
    server.use(
      api.mutation('UpdateAppSettings', ({ variables }) => {
        settings.push(variables);
        return HttpResponse.json({
          data: {
            updateAppSettings: {
              signupMode: 'OPEN',
              poolAutoApprove: false,
              poolKeyLimit: 300,
            },
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      await screen.findByRole('switch', { name: 'Auto-approve a user’s first request' }),
    );
    const limit = screen.getByLabelText('Limit per user');
    await user.clear(limit);
    await user.type(limit, '300{Enter}');
    await user.clear(limit);
    await user.type(limit, '-5');
    await user.tab();
    expect(limit).toHaveValue(500);
    expect(settings).toEqual([
      { input: { poolAutoApprove: false } },
      { input: { poolKeyLimit: 300 } },
    ]);
  });

  it('filters the keys and asks before removing a free one', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Free 1' }));
    expect(screen.queryByText('Key #2')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove from pool' }));
    const dialog = within(screen.getByRole('alertdialog'));
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove from pool' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove from pool' }),
    );
    expect(keyPool.sent).toContainEqual({ operation: 'RemovePoolKey', variables: { id: 1 } });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('closes the deny note with Cancel, and keeps a note on new keys', async () => {
    const user = userEvent.setup();
    renderPanel();
    const row = within((await screen.findByText('Cara Weber')).closest('li') as HTMLElement);
    await user.click(row.getByRole('button', { name: 'Deny (optional note)' }));
    await user.click(row.getByRole('button', { name: 'Cancel' }));
    expect(row.queryByLabelText('Note for the user (optional)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to pool' }));
    expect(keyPool.sent.some((sent) => sent.operation === 'AddPoolKeys')).toBe(false);
    await user.type(screen.getByLabelText('Paste one or many keys'), 'jp_c_3333');
    await user.type(screen.getByPlaceholderText('Note, e.g. Seeker plan, Nov 2026'), 'Nov');
    await user.click(screen.getByRole('button', { name: 'Add to pool' }));
    expect(keyPool.sent).toContainEqual({
      operation: 'AddPoolKeys',
      variables: { input: { keys: 'jp_c_3333', note: 'Nov' } },
    });
  });

  it('says so when the pool can’t load', async () => {
    server.use(api.query('KeyPool', () => HttpResponse.json({ errors: [{ message: 'down' }] })));
    renderPanel();
    expect(await screen.findByRole('alert')).toBeVisible();
  });
});
