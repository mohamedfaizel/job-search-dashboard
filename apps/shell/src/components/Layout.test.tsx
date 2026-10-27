import type { User } from '@jobsearch/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Layout } from './Layout';

const ADMIN: User = { id: 1, email: 'mohamed@example.com', name: 'Mohamed', role: 'ADMIN' };

function renderLayout(props: Partial<Parameters<typeof Layout>[0]> = {}) {
  return render(
    <Layout user={ADMIN} current="dashboard" onNavigate={() => {}} onLogOut={() => {}} {...props}>
      content
    </Layout>,
  );
}

describe('Layout', () => {
  it('marks the current view in the navigation', () => {
    renderLayout();
    expect(screen.getByRole('button', { name: 'Job posts' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Add jobs' })).not.toHaveAttribute('aria-current');
  });

  it('asks to navigate when a nav item is clicked', async () => {
    const onNavigate = vi.fn();
    renderLayout({ onNavigate });
    await userEvent.click(screen.getByRole('button', { name: 'Add jobs' }));
    expect(onNavigate).toHaveBeenCalledWith('add-job');
  });

  it('hides admin-only pages from regular users', () => {
    renderLayout({ user: { ...ADMIN, role: 'USER' } });
    expect(screen.queryByRole('button', { name: 'Add jobs' })).not.toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
  });

  it('shows who is logged in and logs out', async () => {
    const onLogOut = vi.fn();
    renderLayout({ onLogOut });
    expect(screen.getByText('Mohamed')).toHaveAttribute('title', 'mohamed@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogOut).toHaveBeenCalled();
  });
});
