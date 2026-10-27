import { API_URL, createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { api, READY_TAILORED, requests, server } from '../test/server';
import { TailorPanel } from './TailorPanel';

function renderPanel() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <DataProvider store={makeStore()} queryClient={queryClient}>
      <TailorPanel jobId="job-1" />
    </DataProvider>,
  );
}

const withTailored = (tailored: object) => {
  server.use(
    api.query('TailoredResume', () => HttpResponse.json({ data: { tailoredResume: tailored } })),
  );
};
const apiBase = API_URL.replace(/\/graphql\/?$/, '');

describe('TailorPanel', () => {
  it('starts tailoring and says it is running', async () => {
    renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Tailor my resume' }));

    expect(
      await screen.findByText(/Tailoring your resume and writing a cover letter/),
    ).toBeInTheDocument();
    expect(requests).toContainEqual({ operation: 'TailorResume', variables: { jobId: 'job-1' } });
  });

  it('offers both PDFs and the cover letter text', async () => {
    withTailored(READY_TAILORED);
    renderPanel();

    expect(await screen.findByRole('link', { name: 'Download resume PDF' })).toHaveAttribute(
      'href',
      `${apiBase}/tailored/job-1/resume.pdf`,
    );
    expect(screen.getByRole('link', { name: 'Download cover letter PDF' })).toHaveAttribute(
      'href',
      `${apiBase}/tailored/job-1/cover-letter.pdf`,
    );
    expect(screen.getByText(/ATS score of the tailored version: 84 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/I would love to build your dashboard/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tailor again' })).toBeInTheDocument();
  });

  it('still offers the resume when the cover letter failed', async () => {
    withTailored({ ...READY_TAILORED, coverLetter: null });
    renderPanel();

    expect(await screen.findByRole('link', { name: 'Download resume PDF' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Download cover letter PDF' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/cover letter couldn't be written/)).toBeInTheDocument();
  });

  it('shows why tailoring failed', async () => {
    withTailored({ ...READY_TAILORED, status: 'FAILED', error: 'Timed out.' });
    renderPanel();

    expect(await screen.findByText('Timed out.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('explains when tailoring cannot start', async () => {
    server.use(
      api.mutation('TailorResume', () =>
        HttpResponse.json({
          errors: [{ message: 'Send your resume to Resume-Matcher on My profile first.' }],
        }),
      ),
    );
    renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Tailor my resume' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/on My profile first/);
  });
});
