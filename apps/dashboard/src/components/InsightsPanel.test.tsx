import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { api, INSIGHTS, server } from '../test/server';
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
  it('shows the title, language and what your resume is missing', async () => {
    renderPanel();

    expect(await screen.findByText('Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('German')).toBeInTheDocument();
    expect(screen.getByText('Skills: 1 of 2 in your resume')).toBeInTheDocument();

    const missingSkills = screen.getByRole('list', { name: 'Missing skills' });
    expect(within(missingSkills).getByText('graphql')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Skills in your resume' })).getByText(/react/),
    ).toBeInTheDocument();
    const missingKeywords = screen.getByRole('list', { name: 'Missing keywords' });
    expect(within(missingKeywords).getByText('microfrontends')).toBeInTheDocument();
  });

  it('asks for a resume before saying what is missing', async () => {
    server.use(
      api.query('JobInsights', () =>
        HttpResponse.json({
          data: {
            jobInsights: { ...INSIGHTS, hasResume: false, language: 'en', languageDetected: true },
          },
        }),
      ),
    );
    renderPanel();

    expect(await screen.findByText(/Add your resume on “My profile”/)).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('(detected)')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Missing skills' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Skills' })).toHaveTextContent('graphql');
  });
});
