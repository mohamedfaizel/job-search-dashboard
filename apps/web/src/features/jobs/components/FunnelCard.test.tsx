import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import { Intl } from '@/test/intl';
import { funnel } from '../test/server';
import { FunnelCard } from './FunnelCard';

function renderCard(locale: 'en' | 'de' = 'en') {
  render(
    <Intl locale={locale}>
      <DataProvider store={makeStore()} queryClient={createQueryClient()}>
        <FunnelCard />
      </DataProvider>
    </Intl>,
  );
}

const FUNNEL = {
  tracked: 10,
  applied: 8,
  interviews: 2,
  offers: 1,
  rejected: 3,
  waiting: 3,
  responseRate: 0.625,
  interviewRate: 0.25,
  offerRate: 0.5,
  medianDaysToReply: 9.6,
  appliedLast7Days: 2,
  appliedLast30Days: 6,
  bySource: [
    { source: 'JOBHUNTER' as const, applied: 5, interviews: 2, offers: 1 },
    { source: 'ARBEITSAGENTUR' as const, applied: 3, interviews: 0, offers: 0 },
    { source: 'MANUAL' as const, applied: 0, interviews: 0, offers: 0 },
  ],
};

describe('FunnelCard', () => {
  it('shows each step with its share of the step before, the answer stats and the sources', async () => {
    funnel.current = FUNNEL;
    renderCard();
    const card = await screen.findByRole('region', { name: 'Your funnel' });
    const steps = within(card).getAllByRole('listitem');
    expect(steps.map((li) => li.textContent)).toEqual([
      'On tracker10',
      '›Applied880%',
      '›Interview225%',
      '›Offer150%',
    ]);
    expect(screen.getByText('Got an answer').nextSibling).toHaveTextContent('63%');
    expect(screen.getByText('Typical wait').nextSibling).toHaveTextContent('10 days');
    // Sources and the counting note sit behind one small toggle.
    expect(screen.getByText('Sources and how it counts')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Where your applications came from' });
    // A source with no applications is left out.
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('row', { name: 'Arbeitsagentur 3 0 0' })).toBeInTheDocument();
  });

  it('shows dashes before any answer, in German', async () => {
    funnel.current = {
      ...FUNNEL,
      applied: 0,
      interviews: 0,
      offers: 0,
      responseRate: null,
      medianDaysToReply: null,
      bySource: [],
    };
    renderCard('de');
    expect(await screen.findByText('Dein Trichter')).toBeInTheDocument();
    expect(screen.getByText('Antwort erhalten').nextSibling).toHaveTextContent('–');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('stays hidden while nothing is on your tracker', async () => {
    funnel.current = { ...FUNNEL, tracked: 0 };
    renderCard();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Your funnel')).toBeNull();
  });
});
