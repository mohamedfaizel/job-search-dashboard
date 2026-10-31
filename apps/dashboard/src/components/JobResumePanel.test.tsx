import { createQueryClient, DataProvider, jobResumeUrl, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeJob } from '../test/fixtures';
import { jobResume, rejectJobResumeUpload, requests, SAVED_RESUME, server } from '../test/server';
import { ApplyKitPanel } from './ApplyKitPanel';

function renderPanel() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <DataProvider store={makeStore()} queryClient={queryClient}>
      <ApplyKitPanel
        job={makeJob()}
        onStatusChange={() => undefined}
        asking={false}
        onApplyStarted={() => undefined}
        onAnswered={() => undefined}
      />
    </DataProvider>,
  );
}

const section = () => screen.getByRole('region', { name: 'Your resume for this job' });
const toStep2 = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /Save the reply/ }));
};

describe('JobResumePanel', () => {
  it('scores pasted text against the profile resume', async () => {
    const user = userEvent.setup();
    renderPanel();

    await toStep2();
    await user.click(screen.getByRole('button', { name: 'paste it yourself' }));
    await user.type(screen.getByRole('textbox', { name: 'Resume text for this job' }), 'GraphQL');
    await user.click(screen.getByRole('button', { name: 'Save and score' }));

    expect(requests).toContainEqual({
      operation: 'SaveJobResumeText',
      variables: { jobId: 'job-1', text: 'GraphQL' },
    });
    const scores = await within(section()).findByLabelText('Score before and after');
    expect(scores).toHaveTextContent('85%');
    expect(scores).toHaveTextContent('was 50%');
    expect(within(section()).getByText(/Pasted text/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Now covered' })).getByText('graphql'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Still missing')).toHaveTextContent('microfrontends');
    expect(screen.queryByRole('textbox', { name: 'Resume text for this job' })).toBeNull();
  });

  it('uploads a file and offers it for download', async () => {
    const user = userEvent.setup();
    renderPanel();

    const file = new File(['%PDF'], 'resume-acme.pdf', { type: 'application/pdf' });
    await toStep2();
    await user.upload(screen.getByLabelText('Upload resume for this job'), file);

    expect(requests).toContainEqual({ operation: 'UploadJobResume', variables: { sent: true } });
    expect(await within(section()).findByText(/resume-acme\.pdf/)).toBeInTheDocument();
    expect(within(section()).getByRole('link', { name: 'Original' })).toHaveAttribute(
      'href',
      jobResumeUrl('job-1'),
    );
  });

  it('says why an upload failed', async () => {
    server.use(rejectJobResumeUpload);
    const user = userEvent.setup({ applyAccept: false });
    renderPanel();

    const file = new File(['png'], 'photo.png', { type: 'image/png' });
    await toStep2();
    await user.upload(screen.getByLabelText('Upload resume for this job'), file);

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
    // Back to step 1, to write a new one.
    expect(
      await screen.findByRole('button', { name: 'Copy prompt and open Claude ↗' }),
    ).toBeInTheDocument();
  });
});
