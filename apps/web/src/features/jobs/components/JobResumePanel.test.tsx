import { createQueryClient, DataProvider, jobResumeUrl, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Intl } from '@/test/intl';
import { makeJob } from '../test/fixtures';
import {
  downloads,
  jobResume,
  rejectJobResumeUpload,
  requests,
  SAVED_RESUME,
  server,
} from '../test/server';
import { ApplyKitPanel } from './ApplyKitPanel';

function renderPanel() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <Intl>
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <ApplyKitPanel
          job={makeJob()}
          onStatusChange={() => undefined}
          asking={false}
          onApplyStarted={() => undefined}
          onAnswered={() => undefined}
        />
      </DataProvider>
    </Intl>,
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
    const box = screen.getByRole('textbox', { name: 'Claude’s reply' });
    await user.type(box, 'GraphQL');
    // Text without marker lines is all resume.
    expect(screen.getByRole('list', { name: 'Found in the reply' })).toHaveTextContent(
      '✓ Resume found– Cover letter not found– Form answers not found',
    );
    await user.click(screen.getByRole('button', { name: 'Save and download PDF' }));

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
    expect(screen.queryByRole('textbox', { name: 'Claude’s reply' })).toBeNull();
    // The resume PDF downloads straight away.
    expect(downloads).toEqual([`${jobResumeUrl('job-1')}/resume.pdf`]);
    expect(screen.getByText(/Your resume PDF is downloading/)).toBeInTheDocument();
  });

  it('✓ on a still-missing skill offers the updated prompt; keywords get no buttons', async () => {
    const user = userEvent.setup();
    jobResume.current = {
      ...SAVED_RESUME,
      nowCovered: [],
      stillMissing: ['graphql', 'microfrontends'],
    };
    renderPanel();

    const missing = await screen.findByRole('list', { name: 'Still missing' });
    expect(screen.queryByRole('button', { name: 'Copy updated prompt' })).toBeNull();
    // microfrontends is a keyword: Claude works it in, so there is nothing to pick.
    expect(within(missing).queryByRole('button', { name: 'I have microfrontends' })).toBeNull();
    const tick = within(missing).getByRole('button', { name: 'I have graphql' });
    expect(tick).toHaveAccessibleDescription('I have this skill: add it to my resume');
    await user.click(tick);

    expect(requests).toContainEqual({
      operation: 'SetHaveTerm',
      variables: { jobId: 'job-1', term: 'graphql', have: true },
    });
    expect(await screen.findByRole('button', { name: 'Copy updated prompt' })).toBeInTheDocument();
    expect(screen.getByText(/leaves out graphql, which you have/)).toBeInTheDocument();
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Updated prompt' }).value,
    ).toContain('MUST: graphql');
  });

  describe('fact check', () => {
    it('says so when nothing is beyond your resume', async () => {
      jobResume.current = { ...SAVED_RESUME };
      renderPanel();

      expect(
        await screen.findByText(/every number, skill and language level is in your/),
      ).toBeInTheDocument();
    });

    it('shows nothing without a resume of yours to compare with', async () => {
      jobResume.current = { ...SAVED_RESUME, factCheck: null };
      renderPanel();

      await screen.findByLabelText('Score before and after');
      expect(screen.queryByText(/Fact check/)).toBeNull();
      expect(screen.queryByRole('region', { name: /Check before you send/ })).toBeNull();
    });

    it('lists what is not in your resume and copies a fix request', async () => {
      const user = userEvent.setup();
      jobResume.current = {
        ...SAVED_RESUME,
        factCheck: [
          { kind: 'NUMBER', text: '60%', where: 'RESUME', context: 'Cut load time by 60%' },
          { kind: 'NUMBER', text: '45%', where: 'COVER_LETTER', context: 'Raised revenue by 45%' },
          { kind: 'SKILL', text: 'Kubernetes', where: 'RESUME', context: 'React, Kubernetes' },
          { kind: 'LEVEL', text: 'B2', where: 'RESUME', context: 'German (B2)' },
        ],
      };
      renderPanel();

      const box = await screen.findByRole('region', { name: /4 things are not in your resume/ });
      const numbers = within(within(box).getByRole('list', { name: 'Numbers' }));
      expect(numbers.getByText('60%')).toBeInTheDocument();
      expect(numbers.getByText(/\(cover letter\) “Raised revenue by 45%”/)).toBeInTheDocument();
      expect(
        within(within(box).getByRole('list', { name: 'Skills' })).getByText('Kubernetes'),
      ).toBeInTheDocument();
      expect(
        within(within(box).getByRole('list', { name: 'Language levels' })).getByText('B2'),
      ).toBeInTheDocument();

      await user.click(within(box).getByRole('button', { name: 'Copy a fix request for Claude' }));

      const request = within(box).getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Fix request',
      });
      expect(request.value).toContain('Do not invent anything');
      expect(request.value).toContain('- 60%: "Cut load time by 60%"');
      expect(request.value).toContain('- Kubernetes (skill): "React, Kubernetes"');
    });
  });

  it('removes the flagged skills in one click, without a Claude round trip', async () => {
    const user = userEvent.setup();
    jobResume.current = {
      ...SAVED_RESUME,
      factCheck: [
        { kind: 'SKILL', text: 'Kubernetes', where: 'RESUME', context: 'React, Kubernetes' },
      ],
    };
    renderPanel();

    const box = await screen.findByRole('region', { name: /1 thing is not in your resume/ });
    await user.click(within(box).getByRole('button', { name: 'Remove the skills I don’t have' }));

    expect(requests).toContainEqual({
      operation: 'RemoveUnsupportedSkills',
      variables: { jobId: 'job-1' },
    });
    expect(await screen.findByText(/in your resume or profile/)).toBeInTheDocument();
  });

  it('checks the finished PDF the way an ATS reads it', async () => {
    jobResume.current = { ...SAVED_RESUME };
    renderPanel();

    // It runs by itself when the reply is saved: no button to press first.
    const box = await screen.findByRole('region', { name: 'PDF check' });

    expect(await within(box).findByRole('status')).toHaveTextContent('3 things to fix');
    expect(within(box).getByText(/3 pages: keep it to 2/)).toBeInTheDocument();
    expect(within(box).getByText(/Long dashes in dates \(01\/2020 – today\)/)).toBeInTheDocument();
    expect(within(box).getByText(/412 words/)).toBeInTheDocument();
    expect(within(box).getByText('Your name is readable text: User Example')).toBeInTheDocument();
    expect(within(box).getByText(/Text left to fill in: \(fill in\)/)).toBeInTheDocument();
    expect(
      within(box).getByText('Your e-mail is readable text: user@example.com'),
    ).toBeInTheDocument();
    expect(requests).toContainEqual({
      operation: 'ResumePdfCheck',
      variables: { jobId: 'job-1', template: 'modern' },
    });
    expect(within(box).getByRole('button', { name: 'Check again' })).toBeInTheDocument();
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
    // You already have that file, so nothing downloads.
    expect(downloads).toEqual([]);
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
