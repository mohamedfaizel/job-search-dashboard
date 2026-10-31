import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { api, INSIGHTS, requests, server } from '../test/server';
import { InsightsPanel } from './InsightsPanel';

function renderPanel() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <DataProvider store={makeStore()} queryClient={queryClient}>
      <InsightsPanel jobId="job-1" />
    </DataProvider>,
  );
}

describe('InsightsPanel', () => {
  it('shows the title, language, score and what your resume is missing', async () => {
    renderPanel();

    expect(await screen.findByText('Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('German')).toBeInTheDocument();
    expect(screen.getByText('German required (B2)')).toBeInTheDocument();
    expect(screen.getByText('· resume in German')).toBeInTheDocument();
    // The German ad was checked against the English resume: say how to do better.
    expect(screen.getByText(/Fit checked against your English resume/)).toHaveTextContent(
      'Add your resume in German on “My profile”',
    );
    expect(screen.getByRole('img', { name: '50 percent fit' })).toBeInTheDocument();
    expect(screen.getByText(/Skills 1\/2/)).toBeInTheDocument();
    // Weighted like Resume-Matcher's ATS score.
    const parts = screen.getByRole('list', { name: 'Score parts' });
    expect(parts).toHaveTextContent('Keywords 40%: 50%');
    expect(parts).toHaveTextContent('Job title 15%: 100%');
    expect(parts).toHaveTextContent('Dates 10%: 100%');

    const missingSkills = screen.getByRole('list', { name: 'Missing skills' });
    expect(within(missingSkills).getByText('graphql')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'In your resume' })).getByText(/react/),
    ).toBeInTheDocument();
    const missingKeywords = screen.getByRole('list', { name: 'Missing keywords' });
    expect(within(missingKeywords).getByText('microfrontends')).toBeInTheDocument();
    // ✓ and ✕ are for skills only; Claude works the keywords in.
    expect(within(missingSkills).getByRole('button', { name: 'I have graphql' })).toHaveTextContent(
      '✓',
    );
    expect(
      within(missingSkills).getByRole('button', { name: 'Remove graphql' }),
    ).toHaveAccessibleDescription('I don’t have it: remove from this job');
    expect(within(missingKeywords).queryByRole('button')).toBeNull();
    expect(screen.getByText(/use as many of these as honestly fit/)).toBeInTheDocument();
  });

  it('removes a term with × and puts it back', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Remove graphql' }));

    expect(requests).toContainEqual({
      operation: 'RemoveInsightTerm',
      variables: { jobId: 'job-1', term: 'graphql', everywhere: false },
    });
    const removed = await screen.findByRole('list', { name: 'Removed terms' });
    expect(within(removed).getByText('graphql')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '80 percent fit' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Missing skills' })).not.toBeInTheDocument();

    await user.click(within(removed).getByRole('button', { name: 'Remove graphql from all jobs' }));
    expect(requests).toContainEqual({
      operation: 'RemoveInsightTerm',
      variables: { jobId: 'job-1', term: 'graphql', everywhere: true },
    });

    await user.click(screen.getByRole('button', { name: 'Put back graphql' }));
    expect(requests).toContainEqual({
      operation: 'RestoreInsightTerm',
      variables: { jobId: 'job-1', term: 'graphql' },
    });
    expect(await screen.findByRole('list', { name: 'Missing skills' })).toBeInTheDocument();
  });

  it('"I have it" moves a missing skill to "You have these", and Undo moves it back', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'I have graphql' }));

    expect(requests).toContainEqual({
      operation: 'SetHaveTerm',
      variables: { jobId: 'job-1', term: 'graphql', have: true },
    });
    const yours = await screen.findByRole('list', { name: 'You have these' });
    expect(within(yours).getByText(/graphql/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Missing skills' })).not.toBeInTheDocument();
    // Counted as covered.
    expect(screen.getByText(/Skills 2\/2/)).toBeInTheDocument();

    await user.click(within(yours).getByRole('button', { name: 'I don’t have graphql' }));
    expect(requests).toContainEqual({
      operation: 'SetHaveTerm',
      variables: { jobId: 'job-1', term: 'graphql', have: false },
    });
    expect(await screen.findByRole('list', { name: 'Missing skills' })).toBeInTheDocument();
  });

  it('says which skill you have that a missing term goes with', async () => {
    server.use(
      api.query('JobInsights', () =>
        HttpResponse.json({
          data: {
            jobInsights: {
              ...INSIGHTS,
              skills: [{ term: 'apollo', inResume: false, youHave: false, relatedTo: 'graphql' }],
            },
          },
        }),
      ),
    );
    renderPanel();

    const missing = await screen.findByRole('list', { name: 'Missing skills' });
    expect(within(missing).getByText('(you have graphql)')).toBeInTheDocument();
    expect(within(missing).getByRole('button', { name: 'Remove apollo' })).toBeInTheDocument();
  });

  it('says an English resume is fine when the job does not need German', async () => {
    server.use(
      api.query('JobInsights', () =>
        HttpResponse.json({
          data: {
            jobInsights: {
              ...INSIGHTS,
              germanRequired: false,
              germanLevel: null,
              resumeLanguage: 'en',
            },
          },
        }),
      ),
    );
    renderPanel();

    expect(await screen.findByText('· Resume in English')).toBeInTheDocument();
    expect(screen.queryByText(/German required/)).not.toBeInTheDocument();
  });

  it('asks for a resume before saying what is missing', async () => {
    server.use(
      api.query('JobInsights', () =>
        HttpResponse.json({
          data: {
            jobInsights: {
              ...INSIGHTS,
              hasResume: false,
              language: 'en',
              languageDetected: true,
              score: null,
              skillsCoverage: null,
              keywordsCoverage: null,
              titleMatch: null,
            },
          },
        }),
      ),
    );
    renderPanel();

    expect(await screen.findByText(/Add your resume on “My profile”/)).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('(detected)')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /percent fit/ })).not.toBeInTheDocument();
    // Without a resume every term is still listed, and can still be removed.
    expect(screen.getByRole('list', { name: 'Missing skills' })).toHaveTextContent('react');
  });
});
