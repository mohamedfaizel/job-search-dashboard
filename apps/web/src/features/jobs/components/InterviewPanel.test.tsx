import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { Intl } from '@/test/intl';
import { api, INSIGHTS, interviewPrep, requests, server } from '../test/server';
import { InterviewPanel } from './InterviewPanel';

function renderPanel() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <Intl>
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <InterviewPanel jobId="job-1" />
      </DataProvider>
    </Intl>,
  );
}

const SAVED = { text: '1. What they care about\nGraphQL.', updatedAt: '2026-11-03T12:00:00.000Z' };

describe('InterviewPanel', () => {
  it('lists the skills your resume lacks and the German level the ad asks for', async () => {
    renderPanel();

    const gaps = await screen.findByRole('list', { name: 'Likely hard questions' });
    expect(within(gaps).getByText('graphql')).toBeInTheDocument();
    // react is in the resume, so it is no gap.
    expect(within(gaps).queryByText('react')).toBeNull();
    expect(screen.getByText(/asks for German B2/)).toBeInTheDocument();
  });

  it('says so when the resume covers everything, or there is no resume', async () => {
    server.use(
      api.query('JobInsights', () =>
        HttpResponse.json({
          data: {
            jobInsights: {
              ...INSIGHTS,
              germanRequired: false,
              skills: INSIGHTS.skills.map((s) => ({ ...s, inResume: true })),
            },
          },
        }),
      ),
    );
    renderPanel();
    expect(
      await screen.findByText('Your resume covers every skill the ad asks for.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/asks for German/)).toBeNull();
  });

  it('asks you to add a resume when there is none', async () => {
    server.use(
      api.query('JobInsights', () =>
        HttpResponse.json({
          data: {
            jobInsights: { ...INSIGHTS, hasResume: false, germanRequired: false, skills: [] },
          },
        }),
      ),
    );
    renderPanel();
    expect(await screen.findByText(/Add your resume on My profile/)).toBeInTheDocument();
  });

  it('offers the prompt to copy, then saves the reply you paste', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      await screen.findByRole('button', { name: 'Copy interview prompt for Claude' }),
    );
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Interview prompt' }).value,
    ).toBe(INSIGHTS.interviewPrompt);

    await user.type(
      screen.getByRole('textbox', { name: 'Claude’s interview prep' }),
      'GraphQL answers',
    );
    await user.click(screen.getByRole('button', { name: 'Save interview prep' }));

    expect(await screen.findByRole('region', { name: 'Saved interview prep' })).toHaveTextContent(
      'GraphQL answers',
    );
    expect(requests).toContainEqual({
      operation: 'SaveInterviewPrep',
      variables: { jobId: 'job-1', text: 'GraphQL answers' },
    });
    // The prompt and box give way to the saved text.
    expect(screen.queryByRole('textbox', { name: 'Claude’s interview prep' })).toBeNull();
    expect(screen.getByText(/^Saved /)).toBeInTheDocument();
  });

  it('saves the reply straight from the clipboard', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole('button', { name: 'Copy interview prompt for Claude' });
    await navigator.clipboard.writeText('From the clipboard');

    await user.click(
      screen.getByRole('button', { name: 'Paste Claude’s reply from the clipboard' }),
    );

    expect(await screen.findByRole('region', { name: 'Saved interview prep' })).toHaveTextContent(
      'From the clipboard',
    );
  });

  it('shows the saved prep, lets you replace it and delete it', async () => {
    const user = userEvent.setup();
    interviewPrep.current = SAVED;
    renderPanel();

    const saved = await screen.findByRole('region', { name: 'Saved interview prep' });
    expect(saved).toHaveTextContent('1. What they care about');
    expect(screen.queryByRole('button', { name: 'Copy interview prompt for Claude' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Replace' }));
    expect(
      screen.getByRole('button', { name: 'Copy interview prompt for Claude' }),
    ).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Claude’s interview prep' }), 'New');
    await user.click(screen.getByRole('button', { name: 'Save interview prep' }));
    expect(await screen.findByRole('region', { name: 'Saved interview prep' })).toHaveTextContent(
      'New',
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByRole('button', { name: 'Copy interview prompt for Claude' }),
    ).toBeInTheDocument();
    expect(requests.map((r) => r.operation)).toContain('DeleteInterviewPrep');
  });

  it('says why saving failed', async () => {
    const user = userEvent.setup();
    server.use(
      api.mutation('SaveInterviewPrep', () =>
        HttpResponse.json({
          errors: [
            {
              message: 'empty',
              extensions: { apiCode: 'INTERVIEW_PREP_EMPTY', apiParams: {} },
            },
          ],
        }),
      ),
    );
    renderPanel();
    await user.type(await screen.findByRole('textbox', { name: 'Claude’s interview prep' }), 'x');

    await user.click(screen.getByRole('button', { name: 'Save interview prep' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not do that: The interview prep is empty.',
    );
  });

  it('says when the job could not be loaded', async () => {
    server.use(
      api.query('JobInsights', () => HttpResponse.json({ errors: [{ message: 'boom' }] })),
    );
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this job');
  });
});
