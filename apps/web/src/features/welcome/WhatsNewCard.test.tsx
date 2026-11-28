import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import de from '../../../messages/de.json';
import en from '../../../messages/en.json';
import { WhatsNewCard } from './WhatsNewCard';

function renderCard(locale: 'en' | 'de' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : de}>
      <WhatsNewCard />
    </NextIntlClientProvider>,
  );
}

describe("What's new on My Jobs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the four tiles once, and stays closed after ✕', async () => {
    const user = userEvent.setup();
    const { unmount } = renderCard();
    expect(await screen.findByRole('heading', { name: "What's new" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Autopilot' })).toHaveAttribute('href', '/jobs/add');
    expect(screen.getByRole('link', { name: 'Gmail and weekly report' })).toHaveAttribute(
      'href',
      '/settings?tab=gmail',
    );
    expect(screen.getByText(/opens a chat box/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Close What's new" }));
    expect(screen.queryByRole('heading', { name: "What's new" })).not.toBeInTheDocument();
    unmount();

    renderCard();
    expect(screen.queryByRole('heading', { name: "What's new" })).not.toBeInTheDocument();
  });

  it('is in German too', async () => {
    renderCard('de');
    expect(await screen.findByRole('heading', { name: 'Neu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gmail und Wochenbericht' })).toBeInTheDocument();
  });
});
