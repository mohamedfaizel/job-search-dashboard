import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Locale } from '@/i18n/config';
import { Intl } from '../test/intl';
import { location, router } from '../test/navigation';
import { savedLocales } from '../test/server';
import { AuthForm } from './AuthForm';
import type { AuthMode } from './AuthForm';

function renderForm(mode: AuthMode) {
  render(
    <Intl>
      <DataProvider store={makeStore()} queryClient={createQueryClient()}>
        <AuthForm mode={mode} />
      </DataProvider>
    </Intl>,
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

  it('saves the language you picked here on your account when you log in', async () => {
    const user = userEvent.setup();
    const queryClient = createQueryClient();
    const page = (locale: Locale) => (
      <Intl locale={locale}>
        <DataProvider store={makeStore()} queryClient={queryClient}>
          <AuthForm mode="log-in" />
        </DataProvider>
      </Intl>
    );
    const { rerender } = render(page('en'));

    await user.click(screen.getByRole('button', { name: 'Deutsch' }));
    expect(document.cookie).toContain('locale=de');
    expect(router.refresh).toHaveBeenCalled();
    // The refresh brings the page back in German; the form keeps its state.
    rerender(page('de'));
    expect(screen.getByRole('heading')).toHaveTextContent('Bei Job search anmelden');

    await user.type(screen.getByLabelText('E-Mail'), 'mohamed@example.com');
    await user.type(screen.getByLabelText('Passwort'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    // Your account said English: it now says German.
    await vi.waitFor(() => {
      expect(savedLocales).toEqual(['de']);
    });
  });
});
