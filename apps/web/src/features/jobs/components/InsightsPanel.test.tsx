import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { Intl } from '@/test/intl';
import { api, INSIGHTS, removedTerms, requests, server } from '../test/server';
import { InsightsPanel } from './InsightsPanel';

function renderPanel() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <Intl>
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <InsightsPanel jobId="job-1" />
      </DataProvider>
    </Intl>,
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
    // Skills and keywords both get a ✓ with a tooltip, and no ✕ or "I have it" text.
    const tickSkill = within(missingSkills).getByRole('button', { name: 'I have graphql' });
    expect(tickSkill).toHaveTextContent('✓');
    expect(tickSkill).toHaveAccessibleDescription('I have this skill');
    expect(within(missingSkills).queryByRole('button', { name: /Remove/ })).toBeNull();
    const tickKeyword = within(missingKeywords).getByRole('button', {
      name: 'I have microfrontends',
    });
    expect(tickKeyword).toHaveAccessibleDescription(/add it to my profile’s Keywords/);
    expect(screen.getByText(/They go to your profile’s Keywords/)).toBeInTheDocument();
  });

  it('folds away what you removed earlier, with "all jobs" and Put back', async () => {
    removedTerms.push({ term: 'graphql', everywhere: false });
    const user = userEvent.setup();
    renderPanel();

    const removed = await screen.findByRole('list', { name: 'Removed terms' });
    expect(within(removed).getByText('graphql')).toBeInTheDocument();
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

  it('ticking a keyword adds it to your profile’s Keywords, tagged "keyword"', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'I have microfrontends' }));

    expect(requests).toContainEqual({
      operation: 'SetHaveTerm',
      variables: { jobId: 'job-1', term: 'microfrontends', have: true, keyword: true },
    });
    const yours = await screen.findByRole('list', { name: 'You have these' });
    expect(within(yours).getByText(/microfrontends/)).toBeInTheDocument();
    expect(within(yours).getByText('keyword')).toBeInTheDocument();
    // The red ✕ takes it back off, with a tooltip.
    const undo = within(yours).getByRole('button', { name: 'I don’t have microfrontends' });
    expect(undo).toHaveAccessibleDescription('Remove from my profile');
  });

  it('"I have it" moves a missing skill to "You have these", and ✕ moves it back', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'I have graphql' }));

    expect(requests).toContainEqual({
      operation: 'SetHaveTerm',
      variables: { jobId: 'job-1', term: 'graphql', have: true, keyword: false },
    });
    const yours = await screen.findByRole('list', { name: 'You have these' });
    expect(within(yours).getByText(/graphql/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Missing skills' })).not.toBeInTheDocument();
    // Counted as covered.
    expect(screen.getByText(/Skills 2\/2/)).toBeInTheDocument();

    await user.click(within(yours).getByRole('button', { name: 'I don’t have graphql' }));
    expect(requests).toContainEqual({
      operation: 'SetHaveTerm',
      variables: { jobId: 'job-1', term: 'graphql', have: false, keyword: false },
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
    expect(within(missing).getByRole('button', { name: 'I have apollo' })).toBeInTheDocument();
  });

  it('marks a German level read from the ad’s words as an estimate', async () => {
    server.use(
      api.query('JobInsights', () =>
        HttpResponse.json({
          data: { jobInsights: { ...INSIGHTS, germanLevel: 'C1', germanLevelEstimated: true } },
        }),
      ),
    );
    renderPanel();

    const badge = await screen.findByText('German required (about C1)');
    expect(badge.closest('[title]')).toHaveAttribute(
      'title',
      expect.stringContaining('fließend or verhandlungssicher ≈ C1'),
    );
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
