import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { api, READY_MATCH, requests, server } from '../test/server';
import { MatchPanel } from './MatchPanel';

function renderPanel() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <DataProvider store={makeStore()} queryClient={queryClient}>
      <MatchPanel jobId="job-1" />
    </DataProvider>,
  );
}

describe('MatchPanel', () => {
  it('starts a match and says it is running', async () => {
    renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Match my resume' }));

    expect(await screen.findByText(/Matching your resume against this job/)).toBeInTheDocument();
    expect(requests).toContainEqual({ operation: 'MatchJob', variables: { jobId: 'job-1' } });
    expect(screen.queryByRole('button', { name: 'Match my resume' })).not.toBeInTheDocument();
  });

  it('shows the ATS score and what to improve', async () => {
    server.use(api.query('JobMatch', () => HttpResponse.json({ data: { jobMatch: READY_MATCH } })));
    renderPanel();

    expect(await screen.findByText('72')).toBeInTheDocument();
    expect(screen.getByText('Partial fit')).toBeInTheDocument();
    expect(screen.getByText(/it has 55% of the job's keywords/)).toBeInTheDocument();
    const keywords = screen.getByText('Keywords').closest('div')!;
    expect(within(keywords).getByText('70%')).toBeInTheDocument();
    // Dates can't be scored with fewer than two dates on the resume.
    expect(within(screen.getByText('Dates').closest('div')!).getByText('n/a')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
    expect(screen.getByText('GraphQL')).toBeInTheDocument();
    expect(screen.getByText(/to your headline/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Match again' })).toBeInTheDocument();
  });

  it('says when the score is for an older resume', async () => {
    server.use(
      api.query('JobMatch', () =>
        HttpResponse.json({ data: { jobMatch: { ...READY_MATCH, outdated: true } } }),
      ),
    );
    renderPanel();

    expect(await screen.findByText(/You sent a newer resume since this score/)).toBeInTheDocument();
  });

  it('shows why a match failed and offers to try again', async () => {
    server.use(
      api.query('JobMatch', () =>
        HttpResponse.json({
          data: {
            jobMatch: { ...READY_MATCH, status: 'FAILED', score: null, error: 'Timed out.' },
          },
        }),
      ),
    );
    renderPanel();

    expect(await screen.findByText('Timed out.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('explains when the match cannot start', async () => {
    server.use(
      api.mutation('MatchJob', () =>
        HttpResponse.json({
          errors: [{ message: 'Send your resume to Resume-Matcher on My profile first.' }],
        }),
      ),
    );
    renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Match my resume' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/on My profile first/);
  });
});
