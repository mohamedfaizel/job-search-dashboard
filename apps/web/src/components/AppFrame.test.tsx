import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import type { Locale } from '@/i18n/config';
import { Intl } from '../test/intl';
import { location, router } from '../test/navigation';
import { ADMIN, api, savedLocales, server, session } from '../test/server';
import { initialsOf } from './AccountMenu';
import { AppFrame } from './AppFrame';

function renderFrame(locale: Locale = 'en') {
  render(
    <Intl locale={locale}>
      <DataProvider store={makeStore()} queryClient={createQueryClient()}>
        <AppFrame>
          <p>Page content</p>
        </AppFrame>
      </DataProvider>
    </Intl>,
  );
}

describe('AppFrame', () => {
  it('shows the main pages, the gold Job Market and the phone tabs', async () => {
    session.user = ADMIN;
    location.pathname = '/jobs/add';
    renderFrame();

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['My Jobs', 'Tracker', 'Resume']);
    // /jobs/add is "Job Market", not "My Jobs".
    expect(within(nav).getByRole('link', { name: 'My Jobs' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Job Market' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    const tabs = screen.getByRole('navigation', { name: 'Tabs' });
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/jobs', '/tracker', '/resume', '/jobs/add']);
    expect(within(tabs).getByRole('link', { name: 'Add' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Page content')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Account menu for Mohamed' }));
    expect(screen.getByText('admin')).toBeInTheDocument();
    // Only admins get the Admin page in their menu.
    expect(
      within(screen.getByRole('navigation', { name: 'Account' })).getByRole('link', {
        name: 'Admin',
      }),
    ).toHaveAttribute('href', '/admin');
  });

  it('opens the avatar menu with My profile, Settings and Log out', async () => {
    session.user = { ...ADMIN, role: 'USER', name: 'Mohamed Faizel' };
    location.pathname = '/settings';
    const user = userEvent.setup();
    renderFrame();

    const avatar = await screen.findByRole('button', { name: 'Account menu for Mohamed Faizel' });
    expect(avatar).toHaveTextContent('MF');
    // The ⚙ next to the 🔔 opens Settings in one click; it is gold on the Settings page.
    const gear = screen.getByRole('link', { name: 'Settings' });
    expect(gear).toHaveAttribute('href', '/settings');
    expect(gear).toHaveAttribute('aria-current', 'page');

    await user.click(avatar);
    const menu = screen.getByRole('navigation', { name: 'Account' });
    expect(within(menu).getByRole('link', { name: 'My profile' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(within(menu).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.getByText(ADMIN.email)).toBeInTheDocument();
    expect(screen.queryByText('admin')).toBeNull();
    expect(within(menu).queryByRole('link', { name: 'Admin' })).toBeNull();

    // Escape closes it; a link click closes it too.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: 'Account' })).toBeNull();
    await user.click(avatar);
    await user.click(screen.getByRole('link', { name: 'My profile' }));
    expect(screen.queryByRole('navigation', { name: 'Account' })).toBeNull();

    await user.click(avatar);
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('offers Install app in the avatar menu when the browser can install it', async () => {
    session.user = ADMIN;
    const user = userEvent.setup();
    renderFrame();
    const avatar = await screen.findByRole('button', { name: /Account menu/ });
    await user.click(avatar);
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();

    const prompt = vi.fn(() => Promise.resolve());
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('beforeinstallprompt'), {
          prompt,
          userChoice: Promise.resolve({ outcome: 'accepted' }),
        }),
      );
    });
    await user.click(screen.getByRole('button', { name: 'Install app' }));
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('navigation', { name: 'Account' })).toBeNull();
  });

  it('tells iPhone users how to add the app to the home screen', async () => {
    const agent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', { value: 'iPhone', configurable: true });
    session.user = ADMIN;
    const user = userEvent.setup();
    renderFrame();
    await user.click(await screen.findByRole('button', { name: /Account menu/ }));
    expect(screen.getByText(/tap Share, then "Add to Home Screen"/)).toBeInTheDocument();
    Object.defineProperty(navigator, 'userAgent', { value: agent, configurable: true });
  });

  it('sends a new account to the first-login steps, once', async () => {
    session.user = { ...ADMIN, onboarded: false };
    location.pathname = '/jobs';
    renderFrame();
    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/welcome');
    });
  });

  it('stays on the first-login steps while you do them', async () => {
    session.user = { ...ADMIN, onboarded: false };
    location.pathname = '/welcome';
    renderFrame();
    await screen.findByText('Page content');
    expect(router.replace).not.toHaveBeenCalledWith('/welcome');
  });

  it('sends you to /login when the session has expired', async () => {
    location.pathname = '/tracker';
    renderFrame();

    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/login?next=%2Ftracker');
    });
    expect(screen.queryByText('Page content')).toBeNull();
  });

  it('clears an old cookie before /login, so the page never hangs on Loading', async () => {
    // The API says nobody, but the browser still has a cookie (expired, or the account was
    // switched off): without logging out first, the server sends /login straight back here.
    let loggedOut = 0;
    server.use(
      api.mutation('LogOut', () => {
        loggedOut += 1;
        return HttpResponse.json({ data: { logOut: true } });
      }),
    );
    location.pathname = '/jobs';
    renderFrame();

    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/login?next=%2Fjobs');
    });
    expect(loggedOut).toBe(1);
  });

  it('switches to German and saves it on your account', async () => {
    session.user = ADMIN;
    const user = userEvent.setup();
    renderFrame();

    await user.click(await screen.findByRole('button', { name: /Account menu/ }));
    const language = screen.getByRole('group', { name: 'Language' });
    expect(within(language).getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(language).getByRole('button', { name: 'Deutsch' }));

    expect(document.cookie).toContain('locale=de');
    expect(router.refresh).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(savedLocales).toEqual(['de']);
    });
  });

  it('shows the top bar in German', async () => {
    session.user = { ...ADMIN, locale: 'de' };
    renderFrame('de');

    const nav = await screen.findByRole('navigation', { name: 'Hauptmenü' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Meine Jobs', 'Bewerbungen', 'Lebenslauf']);
    expect(screen.getByRole('link', { name: 'Stellenmarkt' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Tabs' })).toHaveTextContent('Hinzufügen');
    // Already in your language: nothing to switch.
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('switches to the language saved on your account', async () => {
    session.user = { ...ADMIN, locale: 'de' };
    renderFrame('en');

    await vi.waitFor(() => {
      expect(router.refresh).toHaveBeenCalled();
    });
    expect(document.cookie).toContain('locale=de');
    expect(savedLocales).toEqual([]);
  });

  it('makes initials from a name', () => {
    expect(initialsOf('Mohamed Faizel Jamal')).toBe('MF');
    expect(initialsOf('  anna ')).toBe('A');
    expect(initialsOf('')).toBe('?');
  });
});
