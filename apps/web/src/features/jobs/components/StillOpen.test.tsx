import type { Job } from '@jobsearch/data';
import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { Intl } from '@/test/intl';
import { JOBS } from '../test/fixtures';
import { api, requests, server } from '../test/server';
import { StillOpen } from './StillOpen';

const JOB = { ...JOBS[0]!, url: 'https://jobs.example.com/1' };

function renderLine(job: Job, autoCheck = false) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  return render(
    <Intl>
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <StillOpen job={job} autoCheck={autoCheck} />
      </DataProvider>
    </Intl>,
  );
}

const checks = () => requests.filter((r) => r.operation === 'CheckJobStillOpen');

describe('StillOpen', () => {
  it('says when a job was never checked, and checks it on request', async () => {
    renderLine(JOB);
    expect(screen.getByText('Not checked yet if the ad is still open')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Check now' }));

    expect(checks()).toEqual([{ operation: 'CheckJobStillOpen', variables: { id: JOB.id } }]);
  });

  it('shows an expired job and why', () => {
    renderLine({ ...JOB, postingStatus: 'expired', lastCheck: 'CLOSED', checkReason: 'NOT_FOUND' });
    expect(screen.getByText('Expired: the page is gone')).toBeInTheDocument();
  });

  it('says when the site blocked the check', () => {
    renderLine({
      ...JOB,
      lastCheck: 'UNKNOWN',
      checkReason: 'BLOCKED',
      checkedAt: new Date().toISOString(),
    });
    expect(screen.getByText(/the site blocks automatic checks/)).toBeInTheDocument();
  });

  it('checks by itself on the Apply tab when the last check is old', async () => {
    renderLine({ ...JOB, checkedAt: '2026-01-01T00:00:00.000Z', lastCheck: 'OPEN' }, true);
    await waitFor(() => {
      expect(checks()).toHaveLength(1);
    });
  });

  it('does not check again by itself when it checked recently', () => {
    renderLine({ ...JOB, checkedAt: new Date().toISOString(), lastCheck: 'OPEN' }, true);
    expect(checks()).toHaveLength(0);
    expect(screen.getByText(/Still open \(checked/)).toBeInTheDocument();
  });

  it('shows why a check failed', async () => {
    server.use(
      api.mutation('CheckJobStillOpen', () =>
        HttpResponse.json({ errors: [{ message: 'Job 1 not found' }] }),
      ),
    );
    renderLine(JOB);
    await userEvent.click(screen.getByRole('button', { name: 'Check now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Check failed: Job 1 not found');
  });
});
