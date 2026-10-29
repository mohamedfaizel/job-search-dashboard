import type { ApplicationStatus, Job } from '@jobsearch/data';
import { applyKitUrl, createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { makeJob } from '../test/fixtures';
import { api, INSIGHTS, jobResume, PROFILE, SAVED_RESUME, server } from '../test/server';
import { ApplyKitPanel, chromePrompt } from './ApplyKitPanel';

function renderKit(job: Job = makeJob(), asking = false) {
  const calls: { status: ApplicationStatus[]; started: string[]; answered: string[] } = {
    status: [],
    started: [],
    answered: [],
  };
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
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
  return { user: userEvent.setup(), calls };
}

describe('ApplyKitPanel', () => {
  it('copies the one prompt for the resume, cover letter and form answers', async () => {
    const { user } = renderKit();

    await user.click(await screen.findByRole('button', { name: 'Copy prompt for Claude' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Copied.');
    expect(await navigator.clipboard.readText()).toBe(INSIGHTS.prompt);
    expect(screen.getByRole('link', { name: /Open Claude/ })).toHaveAttribute(
      'href',
      'https://claude.ai/new',
    );
  });

  it('keeps the cover letter and form answers from Claude’s reply ready to copy', async () => {
    jobResume.current = SAVED_RESUME;
    const { user } = renderKit();

    await user.click(await screen.findByRole('button', { name: 'Copy cover letter' }));
    expect(await navigator.clipboard.readText()).toBe(SAVED_RESUME.coverLetter);
    await user.click(screen.getByRole('button', { name: 'Copy form answers' }));
    expect(await navigator.clipboard.readText()).toBe(SAVED_RESUME.formAnswers);
  });

  it('gives Claude in Chrome a prompt that points at the Apply kit page and never submits', async () => {
    const { user, calls } = renderKit();

    await user.click(
      await screen.findByRole('button', { name: 'Copy prompt for Claude in Chrome' }),
    );
    const prompt = await navigator.clipboard.readText();
    expect(prompt).toBe(chromePrompt(makeJob()));
    expect(prompt).toContain(applyKitUrl('job-1'));
    expect(prompt).toContain('Never click Submit');
    expect(screen.getByRole('link', { name: 'Apply kit page' })).toHaveAttribute(
      'href',
      applyKitUrl('job-1'),
    );

    // Opening the posting asks "Did you apply?" later.
    await user.click(screen.getByRole('link', { name: /Open posting/ }));
    expect(calls.started).toEqual(['job-1']);
  });

  it('marks the job Applied, or asks again later', async () => {
    const { user, calls } = renderKit(makeJob(), true);
    const step = (await screen.findByRole('heading', { name: 'Did you apply?' })).parentElement!;

    await user.click(within(step).getByRole('button', { name: 'Not yet' }));
    expect(calls.answered).toEqual(['job-1']);
    await user.click(within(step).getByRole('button', { name: 'Yes, mark Applied' }));
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
