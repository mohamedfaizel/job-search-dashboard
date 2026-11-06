import { createQueryClient, DataProvider, jobResumeUrl, makeStore } from '@jobsearch/data';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Intl } from '@/test/intl';
import { makeJob } from '../test/fixtures';
import {
  downloads,
  jobResume,
  rejectJobResumeUpload,
  requests,
  savedAnswers,
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
    await user.click(screen.getByRole('button', { name: 'Save reply' }));

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
    expect(
      within(screen.getByRole('region', { name: 'Missing keywords' })).getByRole('listitem', {
        name: 'microfrontends',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Claude’s reply' })).toBeNull();
    // Nothing downloads: the PDF is checked and downloaded in step 3.
    expect(downloads).toEqual([]);
  });

  it('works a missing keyword into the preview: suggestion, rewrite, insert, replace, skip', async () => {
    const user = userEvent.setup();
    jobResume.current = {
      ...SAVED_RESUME,
      stillMissing: ['graphql', 'microfrontends', 'storybook'],
      aiMissing: ['Vitest'],
    };
    renderPanel();

    const box = await screen.findByRole('region', { name: 'Missing keywords' });
    const card = (term: string) => within(box).getByRole('listitem', { name: term });
    const preview = () => within(screen.getByRole('region', { name: 'Preview and edit' }));
    // react and graphql are in the resume text; microfrontends, storybook and Vitest are not.
    expect(within(box).getByText('2 of 5 covered')).toBeInTheDocument();

    // Use suggestion: added to the Skills section.
    await user.click(
      within(card('microfrontends')).getByRole('button', { name: 'Use suggestion' }),
    );
    expect(
      within(card('microfrontends')).getByText('React, TypeScript, microfrontends'),
    ).toBeInTheDocument();
    await user.click(
      within(card('microfrontends')).getByRole('button', { name: 'Apply to resume' }),
    );
    expect(within(card('microfrontends')).getByText('✓ added')).toBeInTheDocument();
    expect(within(box).getByText('3 of 5 covered')).toBeInTheDocument();
    expect(preview().getByText('Unsaved changes')).toBeInTheDocument();

    // Insert a new line under a bullet: it becomes a bullet too.
    await user.click(within(card('storybook')).getByRole('button', { name: 'Insert new line' }));
    const line = within(card('storybook')).getByRole('textbox', { name: 'New line' });
    await user.clear(line);
    await user.type(line, 'Documented UI components in Storybook');
    await user.click(within(card('storybook')).getByRole('button', { name: 'Insert' }));
    expect(
      preview().getByRole('button', { name: /Documented UI components in Storybook/ }),
    ).toBeInTheDocument();

    // Replace a word, everywhere it appears.
    await user.click(within(card('Vitest')).getByRole('button', { name: 'Replace a word' }));
    // Not one of your terms: the fact check warns before you add it.
    expect(within(card('Vitest')).getByRole('note')).toHaveTextContent(
      'Fact check: “Vitest” is not in your master resume',
    );
    await user.type(within(card('Vitest')).getByRole('textbox'), 'GraphQL');
    expect(within(card('Vitest')).getByText('Found in 1 line.')).toBeInTheDocument();
    await user.click(within(card('Vitest')).getByRole('button', { name: 'Replace all' }));
    expect(
      preview().getByRole('button', { name: /Built dashboards in React and Vitest/ }),
    ).toBeInTheDocument();

    // Undo in the preview takes the last change back.
    await user.click(preview().getByRole('button', { name: 'Undo' }));
    expect(
      within(card('Vitest')).getByRole('group', { name: 'Ways to add Vitest' }),
    ).toBeInTheDocument();
    await user.click(within(card('Vitest')).getByRole('button', { name: 'Skip' }));
    expect(within(card('Vitest')).getByText('skipped')).toBeInTheDocument();
    expect(within(card('Vitest')).queryByRole('group', { name: 'Ways to add Vitest' })).toBeNull();

    await user.click(preview().getByRole('button', { name: 'Save changes' }));
    const sent = requests.find((r) => r.operation === 'EditJobResume');
    expect(sent?.variables['resume']).toContain('- React, TypeScript, microfrontends');
    expect(sent?.variables['resume']).toContain(
      '- Built dashboards in React and GraphQL\n- Documented UI components in Storybook',
    );
  });

  it('shows Claude’s questions from the CHECK part as things to answer', async () => {
    jobResume.current = { ...SAVED_RESUME };
    renderPanel();
    const notes = await screen.findByRole('region', { name: 'Notes from Claude' });
    expect(within(notes).getByText('Claude asks you 3 things')).toBeInTheDocument();
    expect(
      within(notes).getByText('0 answered · 0 filled from your saved answers'),
    ).toBeInTheDocument();
    expect(within(notes).getByRole('list', { name: 'Stretches' })).toHaveTextContent(
      'React 19: only in a side project.',
    );
    expect(within(notes).getByRole('list', { name: 'Ask me' })).toHaveTextContent(
      'Which year did you finish school?',
    );
    expect(within(notes).getByText(/graphql \(Replace\)/)).toBeInTheDocument();
    // Nothing answered yet: nothing to copy for Claude.
    expect(within(notes).queryByRole('button', { name: /Copy my answers/ })).toBeNull();
  });

  it('keeps, softens or drops a stretch, answers a question and copies it for Claude', async () => {
    const user = userEvent.setup();
    jobResume.current = { ...SAVED_RESUME };
    renderPanel();
    const notes = within(await screen.findByRole('region', { name: 'Notes from Claude' }));
    const stretches = within(notes.getByRole('list', { name: 'Stretches' }));
    const asks = within(notes.getByRole('list', { name: 'Ask me' }));
    const sent = () =>
      requests.filter((r) => r.operation === 'SaveClaudeAnswers').at(-1)?.variables;

    // Keep: one click, then "Kept" with Change.
    const keepLine = stretches.getAllByRole('listitem')[0]!;
    await user.click(within(keepLine).getByRole('button', { name: '✓ Keep' }));
    expect(within(keepLine).getByText('✓ Kept')).toBeInTheDocument();
    expect(JSON.parse(sent()!['answers'] as string)).toEqual({
      [keepLine.textContent.replace(/✓ Kept.*/, '')]: { choice: 'keep' },
    });

    // Soften: a box with your own words.
    const softLine = within(stretches.getAllByRole('listitem')[1]!);
    await user.click(softLine.getByRole('button', { name: '✎ Soften' }));
    const box = softLine.getByRole('textbox');
    await user.clear(box);
    await user.type(box, 'React 19 (side project)');
    await user.tab();
    expect(softLine.getByText('✎ Softened')).toBeInTheDocument();

    // Change takes a Kept line back to the three buttons; Drop is one click.
    await user.click(within(keepLine).getByRole('button', { name: /Change your choice/ }));
    await user.click(within(keepLine).getByRole('button', { name: '✕ Drop' }));
    expect(within(keepLine).getByText('✕ Dropped')).toBeInTheDocument();

    // A question: type, leave the box, and it is kept for the next jobs.
    const school = asks.getByRole('textbox', { name: /Which year did you finish school/ });
    await user.type(school, '2012');
    await user.tab();
    expect(requests).toContainEqual({
      operation: 'SaveAnswer',
      variables: { question: 'Which year did you finish school?', answer: '2012' },
    });
    expect(notes.getByText('3 answered · 0 filled from your saved answers')).toBeInTheDocument();

    await user.click(notes.getByRole('button', { name: 'Copy my answers for Claude ↗' }));
    const text = notes.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'My answers for Claude',
    }).value;
    expect(text).toContain('- Drop: ');
    expect(text).toContain('Write it like this instead: React 19 (side project)');
    expect(text).toContain('- Which year did you finish school?\n  2012');
  });

  it('does not ask again what you answered before: it is filled in and folded away', async () => {
    const user = userEvent.setup();
    savedAnswers.push({
      id: 1,
      question: 'Which year did you finish your school?',
      answer: '2012',
      updatedAt: '2026-11-05T12:00:00.000Z',
    });
    jobResume.current = { ...SAVED_RESUME };
    renderPanel();
    const notes = within(await screen.findByRole('region', { name: 'Notes from Claude' }));

    // Only the two stretches are open; the school question is answered from your saved answers.
    expect(await notes.findByText('Claude asks you 2 things')).toBeInTheDocument();
    expect(notes.queryByRole('list', { name: 'Ask me' })).toBeNull();
    expect(notes.getByText('1 answered · 1 filled from your saved answers')).toBeInTheDocument();
    await user.click(notes.getByText(/1 question answered before/));
    const school = within(notes.getByRole('list', { name: 'Answered before' })).getByRole(
      'textbox',
      { name: /Which year did you finish school/ },
    );
    expect(school).toHaveValue('2012');
    expect(notes.getByText('From your saved answers')).toBeInTheDocument();

    // Changing it updates the one saved answer, for every job.
    await user.clear(school);
    await user.type(school, '2013');
    await user.tab();
    expect(requests).toContainEqual({
      operation: 'SaveAnswer',
      variables: { question: 'Which year did you finish school?', answer: '2013' },
    });
    // Claude gets the saved answer with your copied answers.
    await user.click(notes.getByRole('button', { name: 'Copy my answers for Claude ↗' }));
    expect(
      notes.getByRole<HTMLTextAreaElement>('textbox', { name: 'My answers for Claude' }).value,
    ).toContain('- Which year did you finish school?\n  2013');
  });

  it('starts Soften with the resume line the stretch is about', async () => {
    const user = userEvent.setup();
    jobResume.current = {
      ...SAVED_RESUME,
      claudeCheck:
        '- Stretches: (1) The Acme job uses "dashboards in React" as the main result. Is that wording OK? (2) React 19: only in a side project.',
    };
    renderPanel();
    const stretches = within(await screen.findByRole('list', { name: 'Stretches' })).getAllByRole(
      'listitem',
    );

    await user.click(within(stretches[0]!).getByRole('button', { name: '✎ Soften' }));
    expect(within(stretches[0]!).getByRole('textbox')).toHaveValue(
      'Built dashboards in React and GraphQL',
    );
    await user.tab();
    // No quoted words: an empty box with a hint, not the question again.
    await user.click(within(stretches[1]!).getByRole('button', { name: '✎ Soften' }));
    const box = within(stretches[1]!).getByRole('textbox');
    expect(box).toHaveValue('');
    expect(box).toHaveAttribute('placeholder', 'Type the softer wording for this line');
  });

  it('shows nothing to decide when Claude’s second reply has no open stretches', async () => {
    jobResume.current = {
      ...SAVED_RESUME,
      claudeCheck:
        '- Placed: graphql (Replace)\n- Stretches: none open. You decided on all of them.\n- Ask me: You did not answer these earlier questions, so I left the related lines unchanged.\n- Ask me: Which year did you finish school?',
    };
    renderPanel();
    const notes = within(await screen.findByRole('region', { name: 'Notes from Claude' }));
    expect(notes.getByText('Claude asks you 1 thing')).toBeInTheDocument();
    expect(notes.queryByRole('list', { name: 'Stretches' })).toBeNull();
    expect(notes.getByRole('list', { name: 'Ask me' }).children).toHaveLength(1);
    expect(notes.queryByText(/did not answer these earlier questions/)).toBeNull();
  });

  it('rewrites a line with the keyword', async () => {
    const user = userEvent.setup();
    jobResume.current = { ...SAVED_RESUME, stillMissing: ['storybook'] };
    renderPanel();
    const card = within(
      within(await screen.findByRole('region', { name: 'Missing keywords' })).getByRole(
        'listitem',
        { name: 'storybook' },
      ),
    );
    await user.click(card.getByRole('button', { name: 'Rewrite a line' }));
    const box = card.getByRole('textbox', { name: 'New words for this line' });
    expect(box).toHaveValue('Built dashboards in React and GraphQL');
    expect(card.getByText('Your words don’t name “storybook” yet.')).toBeInTheDocument();
    await user.type(box, ', documented in Storybook');
    await user.click(card.getByRole('button', { name: 'Apply to resume' }));
    expect(
      screen.getByRole('button', { name: /GraphQL, documented in Storybook/ }),
    ).toBeInTheDocument();
  });

  it('checks the AI match of the saved resume when asked, and shows the score', async () => {
    const user = userEvent.setup();
    jobResume.current = { ...SAVED_RESUME };
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Check AI match' }));

    await waitFor(() => {
      expect(requests).toContainEqual({
        operation: 'MatchJobResume',
        variables: { jobId: 'job-1' },
      });
    });
    expect(await screen.findByText('Resume-Matcher is reading this resume…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();

    jobResume.current = {
      ...SAVED_RESUME,
      aiStatus: 'READY',
      aiScore: 71.4,
      aiMissing: ['Kubernetes'],
      aiTips: ['Add Kubernetes to your skills.'],
    };
    // The panel looks again every few seconds while Resume-Matcher works.
    expect(
      await screen.findByLabelText('AI match 71', undefined, { timeout: 8000 }),
    ).toBeInTheDocument();
    const card = within(screen.getByRole('region', { name: 'AI match (Resume-Matcher)' }));
    expect(card.getByText(/Resume-Matcher misses 1 keyword/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Missing keywords' })).getByRole('listitem', {
        name: 'Kubernetes',
      }),
    ).toBeInTheDocument();
    expect(card.getByText('Tips from Resume-Matcher (1)')).toBeInTheDocument();
    expect(card.getByText('Add Kubernetes to your skills.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'AI match (Resume-Matcher)' })).getByRole(
        'button',
        {
          name: 'Check again',
        },
      ),
    ).toBeEnabled();
  }, 15000);

  it('says why the AI match failed', async () => {
    jobResume.current = { ...SAVED_RESUME, aiStatus: 'FAILED', aiError: 'Resume-Matcher is off.' };
    renderPanel();
    expect(await screen.findByText('Resume-Matcher is off.')).toBeInTheDocument();
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
