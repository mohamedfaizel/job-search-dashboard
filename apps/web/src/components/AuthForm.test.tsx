import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { location, router } from '../test/navigation';
import { AuthForm } from './AuthForm';
import type { AuthMode } from './AuthForm';

function renderForm(mode: AuthMode) {
  render(
    <DataProvider store={makeStore()} queryClient={createQueryClient()}>
      <AuthForm mode={mode} />
    </DataProvider>,
  );
}

describe('AuthForm', () => {
  it('logs in and goes to the page you wanted', async () => {
    location.search = new URLSearchParams({ next: '/tracker' });
    const user = userEvent.setup();
    renderForm('log-in');

    await user.type(screen.getByLabelText('Email'), 'mohamed@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/tracker');
    });
    // The sign-up link keeps where you wanted to go.
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup?next=%2Ftracker',
    );
  });

  it('shows the API error and stays on the page', async () => {
    const user = userEvent.setup();
    renderForm('log-in');

    await user.type(screen.getByLabelText('Email'), 'mohamed@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('signs up and goes to the job list', async () => {
    const user = userEvent.setup();
    renderForm('sign-up');

    await user.type(screen.getByLabelText('Name'), 'Sam');
    await user.type(screen.getByLabelText('Email'), 'sam@example.com');
    await user.type(screen.getByLabelText(/Password/), 'long password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/jobs');
    });
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });
});
