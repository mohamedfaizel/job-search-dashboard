import type { SyncRun } from '@jobsearch/data';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { renderWithData } from '../test/render';
import { api, server } from '../test/server';
import { ImportHistory } from './ImportHistory';

describe('ImportHistory', () => {
  it('lists past imports with their counts, one line each', async () => {
    renderWithData(<ImportHistory />);

    const table = await screen.findByRole('table', { name: 'Your last imports' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('JobHunterFrontend in Berlin:frontend · react · DE · Berlin');
    const cells = within(rows[1]!)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    // New, already saved, credits, pages.
    expect(cells.slice(2)).toEqual(['20', '5', '20', 'Done']);
    expect(rows[2]).toHaveTextContent('backend');
    expect(rows[2]).toHaveTextContent('More left');
    // Only the run the scheduler started gets the tag.
    expect(within(rows[2]!).getByText('Scheduled')).toBeInTheDocument();
    expect(within(rows[1]!).queryByText('Scheduled')).not.toBeInTheDocument();
  });

  it('shows a count of company pages and lists them only when asked', async () => {
    renderWithData(<ImportHistory />);

    const row = within(await screen.findByRole('table')).getAllByRole('row')[3]!;
    expect(row).toHaveTextContent('Company');
    expect(row).toHaveTextContent('Senior Frontend');
    expect(within(row).queryByText('n26')).not.toBeInTheDocument();

    const toggle = within(row).getByRole('button', { name: '3 boards' });
    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const list = within(row).getByRole('list');
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['n26', 'deepl', 'spotify']);
  });

  it('shows the first 8 imports and the rest on request', async () => {
    const run = (id: number): SyncRun => ({
      id,
      startedAt: '2026-10-26T08:00:00.000Z',
      finishedAt: '2026-10-26T08:00:05.000Z',
      complete: true,
      fetched: 1,
      created: 1,
      updated: 0,
      creditsCharged: 1,
      jobsAlreadyPaid: 0,
      savedSearchId: null,
      savedSearchName: null,
      scheduled: false,
      summary: `search ${id}`,
      source: 'JOBHUNTER',
      boards: [],
    });
    server.use(
      api.query('SyncRuns', () =>
        HttpResponse.json({ data: { syncRuns: Array.from({ length: 11 }, (_, i) => run(i + 1)) } }),
      ),
    );
    renderWithData(<ImportHistory />);

    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(9);

    await userEvent.click(screen.getByRole('button', { name: 'Show 3 more' }));
    expect(within(table).getAllByRole('row')).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });
});
