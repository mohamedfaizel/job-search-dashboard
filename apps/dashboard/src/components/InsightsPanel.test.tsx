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
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Skills: 1 of 2 in your resume (50%)')).toBeInTheDocument();

    const missingSkills = screen.getByRole('list', { name: 'Missing skills' });
    expect(within(missingSkills).getByText('graphql')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Skills in your resume' })).getByText(/react/),
    ).toBeInTheDocument();
    const missingKeywords = screen.getByRole('list', { name: 'Missing keywords' });
    expect(within(missingKeywords).getByText('microfrontends')).toBeInTheDocument();
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
    expect(screen.getByText('80%')).toBeInTheDocument();
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

  it('copies the prompt for Claude', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Copy prompt for Claude' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Copied.');
    expect(await navigator.clipboard.readText()).toBe(INSIGHTS.prompt);
    expect(screen.getByRole('link', { name: /Open Claude/ })).toHaveAttribute(
      'href',
      'https://claude.ai/new',
    );
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
            },
          },
        }),
      ),
    );
    renderPanel();

    expect(await screen.findByText(/Add your resume on “My profile”/)).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('(detected)')).toBeInTheDocument();
    expect(screen.queryByText(/Your resume covers/)).not.toBeInTheDocument();
    // Without a resume every term is still listed, and can still be removed.
    expect(screen.getByRole('list', { name: 'Missing skills' })).toHaveTextContent('react');
  });
});
