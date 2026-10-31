import type { ApplicationStatus, Job } from '@jobsearch/data';
import {
  applyKitUrl,
  createQueryClient,
  DataProvider,
  jobResumeUrl,
  makeStore,
} from '@jobsearch/data';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { makeJob } from '../test/fixtures';
import { api, INSIGHTS, jobResume, PROFILE, requests, SAVED_RESUME, server } from '../test/server';
import { ApplyKitPanel, chromePrompt, CLAUDE_URL } from './ApplyKitPanel';

function renderKit(job: Job = makeJob(), asking = false) {
  const calls: { status: ApplicationStatus[]; started: string[]; answered: string[] } = {
    status: [],
    started: [],
    answered: [],
  };
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  const user = userEvent.setup();
  render(
    <DataProvider store={makeStore()} queryClient={queryClient}>
      <ApplyKitPanel
        job={job}
        asking={asking}
        onStatusChange={(status) => calls.status.push(status)}
        onApplyStarted={(j) => calls.started.push(j.id)}
        onAnswered={(j) => calls.answered.push(j.id)}
      />
    </DataProvider>,
  );
  return { user, calls, open };
}

const currentStep = () =>
  within(screen.getByRole('list', { name: 'Apply steps' })).getByRole('button', {
    current: 'step',
  });

describe('ApplyKitPanel', () => {
  it('step 1 copies the prompt, opens Claude and moves on to step 2', async () => {
    const { user, open } = renderKit();

    expect(await screen.findByRole('list', { name: 'What the prompt uses' })).toHaveTextContent(
      'Master resume',
    );
    expect(currentStep()).toHaveTextContent('Write with Claude');
    await user.click(screen.getByRole('button', { name: 'Copy prompt and open Claude ↗' }));

    expect(await navigator.clipboard.readText()).toBe(INSIGHTS.prompt);
    expect(open).toHaveBeenCalledWith(CLAUDE_URL, '_blank', 'noopener');
    expect(currentStep()).toHaveTextContent('Save the reply');
    expect(screen.getByText(/✓ Prompt copied/)).toBeInTheDocument();
  });

  it('says the resume is written in German, with your real German level', async () => {
    server.use(
      api.query('MyProfile', () =>
        HttpResponse.json({ data: { myProfile: { ...PROFILE, languages: ['German A2'] } } }),
      ),
    );
    renderKit();

    const used = await screen.findByRole('list', { name: 'What the prompt uses' });
    expect(used).toHaveTextContent('Written in German (B2 required)');
    expect(await within(used).findByText('German A2 on the resume')).toBeInTheDocument();
  });

  it('step 2 saves Claude’s reply straight from the clipboard', async () => {
    const { user } = renderKit();
    await user.click(await screen.findByRole('button', { name: /Save the reply/ }));

    await navigator.clipboard.writeText('=== RESUME ===\nGraphQL');
    await user.click(screen.getByRole('button', { name: 'Paste from clipboard' }));

    await waitFor(() => {
      expect(requests).toContainEqual({
        operation: 'SaveJobResumeText',
        variables: { jobId: 'job-1', text: '=== RESUME ===\nGraphQL' },
      });
    });
    // Saved: on to step 3, with the score before and after and the PDFs.
    const saved = await screen.findByRole('region', { name: 'Your resume for this job' });
    expect(currentStep()).toHaveTextContent('Fill the form');
    expect(within(saved).getByLabelText('Score before and after')).toHaveTextContent('was 50%');
    // In your template (Modern); another one can be picked for this download.
    await waitFor(() => {
      expect(within(saved).getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
        'href',
        `${jobResumeUrl('job-1')}/resume.pdf?template=modern`,
      );
    });
    await user.selectOptions(
      within(saved).getByRole('combobox', { name: 'Resume template' }),
      'compact',
    );
    expect(within(saved).getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
      'href',
      `${jobResumeUrl('job-1')}/resume.pdf?template=compact`,
    );
    // Your own Word resume is a template too, and the resume downloads as Word to edit.
    expect(within(saved).getByRole('option', { name: 'My own Word file' })).toBeInTheDocument();
    expect(within(saved).getByRole('link', { name: 'Word' })).toHaveAttribute(
      'href',
      `${jobResumeUrl('job-1')}/resume.docx`,
    );
  });

  it('step 3 keeps the cover letter and form answers ready to copy', async () => {
    jobResume.current = SAVED_RESUME;
    const { user } = renderKit();

    await user.click(await screen.findByRole('button', { name: 'Copy cover letter' }));
    expect(await navigator.clipboard.readText()).toBe(SAVED_RESUME.coverLetter);
    await user.click(screen.getByRole('button', { name: 'Copy form answers' }));
    expect(await navigator.clipboard.readText()).toBe(SAVED_RESUME.formAnswers);
    expect(screen.getByRole('link', { name: 'PDF' })).toHaveAttribute(
      'href',
      `${jobResumeUrl('job-1')}/cover-letter.pdf`,
    );
  });

  it('step 3 copies the Claude in Chrome prompt and opens the posting', async () => {
    jobResume.current = SAVED_RESUME;
    const { user, calls, open } = renderKit();

    await user.click(await screen.findByRole('button', { name: 'Copy prompt and open posting ↗' }));

    const prompt = await navigator.clipboard.readText();
    expect(prompt).toBe(chromePrompt(makeJob()));
    expect(prompt).toContain(applyKitUrl('job-1'));
    expect(prompt).toContain('Never click Submit');
    expect(open).toHaveBeenCalledWith('https://example.com/jobs/1', '_blank', 'noopener');
    // Opening the posting asks "Did you apply?" later.
    expect(calls.started).toEqual(['job-1']);
  });

  it('marks the job Applied, or asks again later', async () => {
    const { user, calls } = renderKit(makeJob(), true);

    await user.click(await screen.findByRole('button', { name: 'Not yet' }));
    expect(calls.answered).toEqual(['job-1']);
    await user.click(screen.getByRole('button', { name: 'Yes, mark Applied' }));
    expect(calls.status).toEqual(['APPLIED']);
  });

  it('says when the job is already applied for', async () => {
    renderKit(makeJob({ applicationStatus: 'INTERVIEWING' }));
    expect(await screen.findByText('✓ On your tracker as applied.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes, mark Applied' })).not.toBeInTheDocument();
  });

  it('asks for the Application answers when the profile has none', async () => {
    server.use(
      api.query('MyProfile', () =>
        HttpResponse.json({
          data: {
            myProfile: { ...PROFILE, phone: '', address: '', workPermit: '', noticePeriod: '' },
          },
        }),
      ),
    );
    renderKit();
    expect(await screen.findByText(/Add your Application answers/)).toBeInTheDocument();
  });
});
