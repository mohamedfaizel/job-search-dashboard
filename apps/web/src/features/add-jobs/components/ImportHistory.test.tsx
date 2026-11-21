import type { SyncRun } from '@jobsearch/data';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { renderWithData } from '../test/render';
import { api, requests, server } from '../test/server';
import { ImportHistory } from './ImportHistory';

const STOPPED: SyncRun = {
  id: 9,
  startedAt: '2026-11-18T08:00:00.000Z',
  finishedAt: '2026-11-18T08:00:05.000Z',
  complete: false,
  fetched: 10,
  created: 10,
  updated: 0,
  creditsCharged: 10,
  jobsAlreadyPaid: 0,
  savedSearchId: null,
  savedSearchName: null,
  scheduled: false,
  summary: 'senior frontend · react',
  source: 'JOBHUNTER',
  boards: [],
  canContinue: true,
};

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
    // New, already saved, credits, more left.
    expect(cells.slice(2)).toEqual(['20', '5', '20', 'Nothing left']);
    expect(rows[2]).toHaveTextContent('backend');
    expect(within(rows[2]!).getByRole('button', { name: 'Continue ›' })).toBeInTheDocument();
    // Only the run the scheduler started gets the tag.
    expect(within(rows[2]!).getByText('Scheduled')).toBeInTheDocument();
    expect(within(rows[1]!).queryByText('Scheduled')).not.toBeInTheDocument();
  });

  it('continues an import that stopped with pages left', async () => {
    const user = userEvent.setup();
    renderWithData(<ImportHistory />);

    const row = within(await screen.findByRole('table')).getAllByRole('row')[2]!;
    await user.click(within(row).getByRole('button', { name: 'Continue ›' }));
    await vi.waitFor(() => {
      expect(requests).toContainEqual({ operation: 'ContinueImport', variables: { runId: 6 } });
    });
  });

  it('says when a newer import of the same search ran instead', async () => {
    server.use(
      api.query('SyncRuns', () =>
        HttpResponse.json({
          data: { syncRuns: [{ ...STOPPED, id: 9, canContinue: false }] },
        }),
      ),
    );
    renderWithData(<ImportHistory />);
    const row = within(await screen.findByRole('table')).getAllByRole('row')[1]!;
    expect(row).toHaveTextContent('Newer import ran');
    expect(within(row).queryByRole('button', { name: 'Continue ›' })).toBeNull();
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
      canContinue: false,
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
