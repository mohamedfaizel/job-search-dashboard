import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from './App';
import { ADMIN, session } from './test/server';

function renderShell() {
  return render(
    <DataProvider store={makeStore()} queryClient={createQueryClient()}>
      <Shell />
    </DataProvider>,
  );
}

describe('Shell', () => {
  it('asks you to log in, then shows the app', async () => {
    renderShell();

    const form = await screen.findByRole('form', { name: 'Log in' });
    await userEvent.type(within(form).getByLabelText('Email'), 'mohamed@example.com');
    await userEvent.type(within(form).getByLabelText('Password'), 'correct horse');
    await userEvent.click(within(form).getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Dashboard microfrontend')).toBeInTheDocument();
    expect(screen.getByText('Mohamed')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('shows why a login failed', async () => {
    renderShell();

    const form = await screen.findByRole('form', { name: 'Log in' });
    await userEvent.type(within(form).getByLabelText('Email'), 'mohamed@example.com');
    await userEvent.type(within(form).getByLabelText('Password'), 'wrong password');
    await userEvent.click(within(form).getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password');
  });

  it('signs up a regular user, who does not get the admin-only page', async () => {
    renderShell();

    await userEvent.click(await screen.findByRole('button', { name: 'Create an account' }));
    const form = screen.getByRole('form', { name: 'Sign up' });
    await userEvent.type(within(form).getByLabelText('Name'), 'Visitor');
    await userEvent.type(within(form).getByLabelText('Email'), 'visitor@example.com');
    await userEvent.type(within(form).getByLabelText(/^Password/), 'visitor-pass');
    await userEvent.click(within(form).getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Visitor')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('button', { name: 'Job posts' })).toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: 'Add jobs' })).not.toBeInTheDocument();

    await userEvent.click(within(nav).getByRole('button', { name: 'Tracker' }));
    expect(await screen.findByText('Tracker microfrontend')).toBeInTheDocument();
    await userEvent.click(within(nav).getByRole('button', { name: 'My profile' }));
    expect(await screen.findByText('Profile microfrontend')).toBeInTheDocument();
  });

  it('logs out back to the login page', async () => {
    session.user = ADMIN;
    renderShell();

    await userEvent.click(await screen.findByRole('button', { name: 'Add jobs' }));
    expect(await screen.findByText('Job form microfrontend')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('form', { name: 'Log in' })).toBeInTheDocument();
  });
});
