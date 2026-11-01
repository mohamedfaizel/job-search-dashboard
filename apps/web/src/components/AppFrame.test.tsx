import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { location, router } from '../test/navigation';
import { ADMIN, session } from '../test/server';
import { AppFrame } from './AppFrame';

function renderFrame() {
  render(
    <DataProvider store={makeStore()} queryClient={createQueryClient()}>
      <AppFrame>
        <p>Page content</p>
      </AppFrame>
    </DataProvider>,
  );
}

describe('AppFrame', () => {
  it('shows the links, marks the current page and logs out', async () => {
    session.user = ADMIN;
    location.pathname = '/jobs/add';
    const user = userEvent.setup();
    renderFrame();

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Job posts',
      'Tracker',
      'Add jobs',
      'My profile',
    ]);
    // /jobs/add is "Add jobs", not "Job posts".
    expect(within(nav).getByRole('link', { name: 'Add jobs' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Job posts' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('hides "Add jobs" from a regular user', async () => {
    session.user = { ...ADMIN, role: 'USER' };
    renderFrame();

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: 'Add jobs' })).toBeNull();
  });

  it('sends you to /login when the session has expired', async () => {
    location.pathname = '/tracker';
    renderFrame();

    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/login?next=%2Ftracker');
    });
    expect(screen.queryByText('Page content')).toBeNull();
  });
});
