import type { Application, MailSuggestion } from '@jobsearch/data';
import { createQueryClient, DataProvider, makeStore, API_URL } from '@jobsearch/data';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { graphql } from 'msw/graphql';
import { Intl } from '@/test/intl';
import { JOBS } from '../test/fixtures';
import { applications, mailSuggestions, requests, server } from '../test/server';
import { TrackerPage } from '../Tracker';

const [FRONTEND] = JOBS as [(typeof JOBS)[number]];

const SUGGESTION: MailSuggestion = {
  id: 7,
  jobId: FRONTEND.id,
  jobTitle: FRONTEND.title,
  company: FRONTEND.company.name,
  currentStatus: 'APPLIED',
  status: 'REJECTED',
  accountEmail: 'me@gmail.com',
  fromAddress: 'Acme Recruiting <jobs@acme.de>',
  subject: 'Your application',
  snippet: 'Unfortunately we will not be moving forward.',
  receivedAt: '2026-11-02T09:00:00.000Z',
};

function renderTracker(locale: 'en' | 'de' = 'en') {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <Intl locale={locale}>
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <TrackerPage />
      </DataProvider>
    </Intl>,
  );
}

const appliedJob = (): Application => ({
  status: 'APPLIED',
  updatedAt: '2026-10-26T09:00:00.000Z',
  followedUpAt: null,
  followUpDue: false,
  job: { ...FRONTEND, applicationStatus: 'APPLIED' },
});

const panel = () => screen.findByRole('region', { name: /suggest/ });

describe('email suggestions on the tracker', () => {
  it('shows nothing when no email suggests a change', async () => {
    applications.push(appliedJob());
    renderTracker();
    await screen.findByText(FRONTEND.title);
    expect(screen.queryByRole('region', { name: /suggest/ })).not.toBeInTheDocument();
  });

  it('shows what the email says and the suggested move', async () => {
    applications.push(appliedJob());
    mailSuggestions.push(SUGGESTION);
    renderTracker();
    const region = await panel();
    expect(within(region).getByRole('heading')).toHaveTextContent('1 email suggests a change');
    expect(region).toHaveTextContent('Applied → Rejected');
    expect(region).toHaveTextContent('Unfortunately we will not be moving forward.');
    expect(region).toHaveTextContent('Acme Recruiting <jobs@acme.de> to me@gmail.com');
  });

  it('moves the job when you approve, and the card goes away', async () => {
    applications.push(appliedJob());
    mailSuggestions.push(SUGGESTION);
    renderTracker();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Move .* to Rejected/ }));
    expect(requests).toContainEqual({ operation: 'ApproveMailSuggestion', variables: { id: 7 } });
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /suggest/ })).not.toBeInTheDocument();
    });
  });

  it('leaves the job alone when you dismiss', async () => {
    applications.push(appliedJob());
    mailSuggestions.push(SUGGESTION);
    renderTracker();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Ignore the suggestion/ }));
    expect(requests).toContainEqual({ operation: 'DismissMailSuggestion', variables: { id: 7 } });
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /suggest/ })).not.toBeInTheDocument();
    });
    expect(applications[0]?.status).toBe('APPLIED');
  });

  it('says what went wrong when the answer fails', async () => {
    applications.push(appliedJob());
    mailSuggestions.push(SUGGESTION);
    server.use(
      graphql
        .link(API_URL)
        .mutation('ApproveMailSuggestion', () =>
          HttpResponse.json({ errors: [{ message: 'boom' }] }),
        ),
    );
    renderTracker();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Move .* to Rejected/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not answer that suggestion');
    expect(await panel()).toBeInTheDocument();
  });

  it('speaks German', async () => {
    applications.push(appliedJob());
    mailSuggestions.push(SUGGESTION);
    renderTracker('de');
    const region = await screen.findByRole('region', { name: /schlägt/ });
    expect(region).toHaveTextContent('Beworben → Abgesagt');
    expect(
      within(region).getByRole('button', { name: /nach Abgesagt verschieben/ }),
    ).toBeInTheDocument();
  });
});
