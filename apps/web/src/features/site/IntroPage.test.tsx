import { render, screen, within } from '@testing-library/react';
import type { Locale } from '@/i18n/config';
import { Intl } from '../../test/intl';
import { IntroPage } from './IntroPage';
import { JOB_HUNTER_SOURCES, SOURCE_COUNT } from './sources';

function renderIntro({
  loggedIn = false,
  locale = 'en',
}: { loggedIn?: boolean; locale?: Locale } = {}) {
  render(
    <Intl locale={locale}>
      <IntroPage loggedIn={loggedIn} />
    </Intl>,
  );
}

describe('IntroPage', () => {
  it('opens with the message from the maker, then the promise and Sign up', () => {
    renderIntro();
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings[0]).toBe('I built this for my own job search');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Find the right jobs. Apply faster. Keep track.',
    );
    for (const link of screen.getAllByRole('link', { name: 'Create my account' })) {
      expect(link).toHaveAttribute('href', '/signup');
    }
    expect(screen.getByText(/comes with 500 JobHunter credits/)).toBeInTheDocument();
  });

  it('shows Log in and Sign up to visitors, and My Jobs when logged in', () => {
    renderIntro();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(within(header).getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/signup',
    );
  });

  it('shows My Jobs instead of Log in when you are logged in', () => {
    renderIntro({ loggedIn: true });
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Open My Jobs' })).toHaveAttribute(
      'href',
      '/jobs',
    );
    expect(within(header).queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
  });

  it('lists the four things that make the app different and all 40 live sources', () => {
    renderIntro();
    for (const title of [
      'It remembers your missing skills',
      'Every job detail, highlighted',
      'Scheduled searches and alerts',
      'Know what to ask for',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(SOURCE_COUNT).toBe(40);
    expect(screen.getByText(JOB_HUNTER_SOURCES.boards.join(' · '))).toBeInTheDocument();
    expect(screen.getByText(JOB_HUNTER_SOURCES.ats.join(' · '))).toBeInTheDocument();
  });

  it('hides the demo button until there is a video', () => {
    renderIntro();
    expect(screen.queryByRole('link', { name: /Watch the demo/ })).not.toBeInTheDocument();
  });

  it('ends with the maker line that leads to questions and ideas', () => {
    renderIntro();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('Made by Mohamed Faizel')).toBeInTheDocument();
    expect(
      within(footer).getByRole('link', { name: /Queries and suggestions welcome/ }),
    ).toHaveAttribute('href', '/about#contact');
  });

  it('speaks German', () => {
    renderIntro({ locale: 'de' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Passende Jobs finden. Schneller bewerben. Den Überblick behalten.',
    );
    expect(screen.getAllByRole('link', { name: 'Konto erstellen' }).length).toBeGreaterThan(0);
  });
});
