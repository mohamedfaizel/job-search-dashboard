import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Intl } from '@/test/intl';
import { makeJob } from '../test/fixtures';
import { salary } from '../test/server';
import { parseAmount, SalaryPanel } from './SalaryPanel';

function renderPanel(language: string | null = 'en') {
  render(
    <Intl locale="en">
      <DataProvider store={makeStore()} queryClient={createQueryClient()}>
        <SalaryPanel job={makeJob({ language })} active />
      </DataProvider>
    </Intl>,
  );
}

const RESEARCH = {
  currency: 'EUR',
  basis: 'TITLE' as const,
  sampleSize: 12,
  estimatedCount: 3,
  low: 58000,
  median: 66000,
  high: 74000,
  jobMin: 60000,
  jobMax: 70000,
  ask: 74000,
  examples: [{ jobId: 'x1', title: 'Data Analyst', company: 'Nordwind', min: 62000, max: 70000 }],
  expectation: '65k',
  prompt: 'Please help me negotiate',
};

describe('parseAmount', () => {
  it('reads the ways people type amounts', () => {
    expect(parseAmount('76000')).toBe(76000);
    expect(parseAmount('76.000 €')).toBe(76000);
    expect(parseAmount('76k')).toBe(76000);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('SalaryPanel', () => {
  it('shows the market range and scripts with the suggested ask', async () => {
    salary.current = RESEARCH;
    renderPanel();
    expect(await screen.findByText(/12 ads with a similar title/)).toBeInTheDocument();
    expect(screen.getByText(/3 of them are estimates/)).toBeInTheDocument();
    expect(screen.getByText('€66,000')).toBeInTheDocument();
    expect(screen.getByText('This ad: €60,000 – €70,000')).toBeInTheDocument();
    expect(screen.getByText(/Your saved expectation: 65k/)).toBeInTheDocument();
    expect(screen.getByText(/around €74,000/)).toBeInTheDocument();
  });

  it('updates the scripts from your ask and their offer', async () => {
    salary.current = RESEARCH;
    renderPanel('de');
    const ask = await screen.findByLabelText('Your ask, yearly (EUR)');
    await userEvent.clear(ask);
    await userEvent.type(ask, '80k');
    await userEvent.type(screen.getByLabelText('Their offer, if you have one'), '70000');
    expect(screen.getByText(/etwa 80.000 € brutto/)).toBeInTheDocument();
    expect(screen.getByText(/Angebot über 70.000 €/)).toBeInTheDocument();
    expect(screen.getByText(/Antrittsprämie von 10.000 €/)).toBeInTheDocument();

    await userEvent.clear(ask);
    expect(screen.getByText(/Type the yearly amount/)).toBeInTheDocument();
  });

  it('says when there is nothing to compare with, and copies a script', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    salary.current = {
      ...RESEARCH,
      basis: 'NONE',
      sampleSize: 0,
      low: null,
      median: null,
      high: null,
      expectation: '',
    };
    renderPanel();
    expect(await screen.findByText(/No salaries for similar jobs/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]!);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('around €74,000'));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('falls back to the job function', async () => {
    salary.current = {
      ...RESEARCH,
      basis: 'FUNCTION',
      estimatedCount: 0,
      jobMin: null,
      jobMax: null,
    };
    renderPanel();
    expect(await screen.findByText(/same job function and country/)).toBeInTheDocument();
    expect(screen.queryByText(/This ad:/)).not.toBeInTheDocument();
  });
});
