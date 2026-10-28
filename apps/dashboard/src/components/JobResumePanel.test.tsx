import { createQueryClient, DataProvider, jobResumeUrl, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jobResume, rejectJobResumeUpload, requests, SAVED_RESUME, server } from '../test/server';
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

const section = () => screen.getByRole('region', { name: 'Your resume for this job' });

describe('JobResumePanel', () => {
  it('scores pasted text against the profile resume', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Paste text' }));
    await user.type(screen.getByRole('textbox', { name: 'Resume text for this job' }), 'GraphQL');
    await user.click(screen.getByRole('button', { name: 'Save and score' }));

    expect(requests).toContainEqual({
      operation: 'SaveJobResumeText',
      variables: { jobId: 'job-1', text: 'GraphQL' },
    });
    const scores = await within(section()).findByLabelText('Score before and after');
    expect(scores).toHaveTextContent('Before50%→After85%');
    expect(within(section()).getByText('Pasted text')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Now covered' })).getByText('graphql'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Still missing' })).getByText('microfrontends'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Resume text for this job' })).toBeNull();
  });

  it('uploads a file and offers it for download', async () => {
    const user = userEvent.setup();
    renderPanel();

    const file = new File(['%PDF'], 'resume-acme.pdf', { type: 'application/pdf' });
    await user.upload(await screen.findByLabelText('Upload resume for this job'), file);

    expect(requests).toContainEqual({ operation: 'UploadJobResume', variables: { sent: true } });
    expect(await within(section()).findByText('resume-acme.pdf')).toBeInTheDocument();
    expect(within(section()).getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      jobResumeUrl('job-1'),
    );
  });

  it('says why an upload failed', async () => {
    server.use(rejectJobResumeUpload);
    const user = userEvent.setup({ applyAccept: false });
    renderPanel();

    const file = new File(['png'], 'photo.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText('Upload resume for this job'), file);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Upload a PDF, Word (.docx), text or Markdown file',
    );
  });

  it('deletes the saved resume', async () => {
    jobResume.current = SAVED_RESUME;
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      await within(
        await screen.findByRole('region', { name: 'Your resume for this job' }),
      ).findByRole('button', { name: 'Delete' }),
    );

    expect(requests).toContainEqual({
      operation: 'DeleteJobResume',
      variables: { jobId: 'job-1' },
    });
    expect(await screen.findByText(/Wrote a resume with the prompt/)).toBeInTheDocument();
  });
});
