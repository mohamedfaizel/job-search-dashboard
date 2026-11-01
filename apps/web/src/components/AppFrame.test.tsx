import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Locale } from '@/i18n/config';
import { Intl } from '../test/intl';
import { location, router } from '../test/navigation';
import { ADMIN, savedLocales, session } from '../test/server';
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

  it('switches to German and saves it on your account', async () => {
    session.user = ADMIN;
    const user = userEvent.setup();
    renderFrame();

    const language = await screen.findByRole('group', { name: 'Language' });
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
    ).toEqual(['Stellenanzeigen', 'Bewerbungen', 'Jobs hinzufügen', 'Mein Profil']);
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument();
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
});
