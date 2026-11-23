import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Locale } from '@/i18n/config';
import { Intl } from '../../test/intl';
import { SLIDE_MS } from './DifferentSlider';
import { IntroContent, IntroPage } from './IntroPage';
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
  it('opens with the maker welcome from About us, and ends with Sign up', () => {
    renderIntro();
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings[0]).toBe("One person's job search, now shared with everyone");
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "One person's job search, now shared with everyone",
    );
    const welcome = screen.getByRole('region', { name: /One person's job search/ });
    expect(
      within(welcome).getByRole('img', { name: 'Mohamed Faizel at his desk with a laptop' }),
    ).toBeInTheDocument();
    expect(within(welcome).getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/mohamedfaizel',
    );
    // A visitor logs in first, then comes back with the message window open.
    expect(within(welcome).getByRole('link', { name: 'Message Mohamed Faizel' })).toHaveAttribute(
      'href',
      '/login?next=%2Fabout%3Fmessage%3D1',
    );
    // The old big title and the story, values and technology cards are gone.
    expect(screen.queryByText(/Apply faster/)).not.toBeInTheDocument();
    expect(screen.queryByText('The story')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create my account' })).toHaveAttribute(
      'href',
      '/signup',
    );
  });

  it('marks About us as the page you are on when opened from /about', () => {
    render(
      <Intl>
        <IntroPage loggedIn={false} current="about" />
      </Intl>,
    );
    expect(screen.getByRole('link', { name: 'About us', current: 'page' })).toBeInTheDocument();
  });

  it('inside the app, opens the message window and ends with My Jobs', () => {
    render(
      <Intl>
        <IntroContent loggedIn />
      </Intl>,
    );
    expect(screen.getByRole('button', { name: 'Message Mohamed Faizel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open My Jobs' })).toHaveAttribute('href', '/jobs');
    expect(screen.queryByRole('link', { name: 'Create my account' })).not.toBeInTheDocument();
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

  it('shows the four things that make the app different as tabs, titles only', () => {
    renderIntro();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      '1It remembers your missing skills',
      '2Every job detail, highlighted',
      '3Scheduled searches and alerts',
      '4Know what to ask for',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(
      within(screen.getByRole('tabpanel')).getByRole('img', { name: /missing skills/ }),
    ).toBeInTheDocument();
    // The long descriptions are gone.
    expect(screen.queryByText(/Tick the ones you really have/)).not.toBeInTheDocument();
  });

  it('moves the slider on by itself, and stops once you pick a picture', () => {
    vi.useFakeTimers();
    try {
      renderIntro();
      act(() => {
        vi.advanceTimersByTime(SLIDE_MS);
      });
      expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
      fireEvent.click(screen.getByRole('tab', { name: /Know what to ask for/ }));
      expect(screen.getByRole('img', { name: /Salary tab/ })).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(SLIDE_MS * 2);
      });
      expect(screen.getAllByRole('tab')[3]).toHaveAttribute('aria-selected', 'true');
      // Arrows wrap around; ← and → move between tabs.
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
      expect(screen.getAllByRole('tab')[3]).toHaveAttribute('aria-selected', 'true');
      fireEvent.keyDown(screen.getAllByRole('tab')[3] as HTMLElement, { key: 'ArrowRight' });
      expect(screen.getAllByRole('tab')[0]).toHaveFocus();
      fireEvent.keyDown(screen.getAllByRole('tab')[0] as HTMLElement, { key: 'Home' });
      fireEvent.keyDown(screen.getAllByRole('tab')[0] as HTMLElement, { key: 'ArrowLeft' });
      expect(screen.getAllByRole('tab')[3]).toHaveAttribute('aria-selected', 'true');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the Job Market next to all 40 live sources', () => {
    renderIntro();
    const market = screen.getByRole('region', { name: 'Live jobs from 40+ sources' });
    expect(within(market).getByText('Job Market')).toBeInTheDocument();
    expect(
      within(market).getByRole('img', { name: 'Job Market form with three sources' }),
    ).toBeInTheDocument();
    expect(SOURCE_COUNT).toBe(40);
    expect(within(market).getByText(JOB_HUNTER_SOURCES.boards.join(' · '))).toBeInTheDocument();
    expect(within(market).getByText(JOB_HUNTER_SOURCES.ats.join(' · '))).toBeInTheDocument();
    expect(screen.queryByText('One search, many job boards')).not.toBeInTheDocument();
  });

  it('has no footer', () => {
    renderIntro();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('speaks German', () => {
    renderIntro({ locale: 'de' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Die Jobsuche einer Person, jetzt für alle',
    );
    expect(screen.getAllByRole('link', { name: 'Konto erstellen' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument();
  });
});
