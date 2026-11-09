import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Intl } from '@/test/intl';
import { trust } from '../test/server';
import { JobTrust } from './JobTrust';

function renderTrust(locale: 'en' | 'de' = 'en') {
  render(
    <Intl locale={locale}>
      <DataProvider store={makeStore()} queryClient={createQueryClient()}>
        <JobTrust job={{ id: 'j1' }} />
      </DataProvider>
    </Intl>,
  );
}

describe('JobTrust', () => {
  it('says so when the ad shows no warning signs', async () => {
    renderTrust();
    expect(await screen.findByText('No warning signs in this ad')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps weak signs behind Show, with the repost count and date', async () => {
    trust.set('j1', {
      level: 'CAUTION',
      flags: ['REPOSTED', 'OLD_AD'],
      reposts: 3,
      firstPostedAt: '2026-05-04T00:00:00.000Z',
      ageDays: 60,
    });
    renderTrust();
    expect(await screen.findByText('2 things to check before you apply')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(
      screen.getByText(/Posted 3 times before by this company since May 4, 2026/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Open for 60 days/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows scam signs right away, in German too', async () => {
    trust.set('j1', {
      level: 'WARNING',
      flags: ['ASKS_PAYMENT', 'REPOSTED'],
      reposts: 1,
      firstPostedAt: '2026-10-01T00:00:00.000Z',
      ageDays: 2,
    });
    renderTrust('de');
    expect(await screen.findByText('Vorsicht: das könnte Betrug sein')).toBeInTheDocument();
    expect(screen.getByText(/Verlangt Geld/)).toBeInTheDocument();
    expect(screen.getByText(/schon einmal geschaltet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ausblenden' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
