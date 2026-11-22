import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Intl } from '@/test/intl';
import { keyPool } from '@/test/server';
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
});
