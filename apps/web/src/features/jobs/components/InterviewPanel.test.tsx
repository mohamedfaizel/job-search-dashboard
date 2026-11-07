import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { Intl } from '@/test/intl';
import { api, INSIGHTS, interviewPrep, requests, server } from '../test/server';
import { InterviewPanel } from './InterviewPanel';

function renderPanel() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <Intl>
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <InterviewPanel jobId="job-1" />
      </DataProvider>
    </Intl>,
  );
}

const SAVED = { text: '1. What they care about\nGraphQL.', updatedAt: '2026-11-03T12:00:00.000Z' };

const FULL = `## 1. What they care about
- Fast React apps
- GraphQL
## 2. Tell me about yourself
I build dashboards.
## 3. Likely questions
Q1. How do you keep a React app fast?
Why they ask: the ad says Core Web Vitals.
Answer: I split the bundle at Bank X.
Q2. **Tell me about a hard bug.**
Why they ask: to see how you think.
Answer: A race in the payments form.
## 4. My gaps
Gap: GraphQL
Say: I used REST APIs, and I know the GraphQL ideas.
Learn this week: the Apollo tutorial.
## 5. Questions for them
- What does a good first month look like?
## 6. Research checklist
- [ ] Read the About us page
- [ ] Try their app`;

describe('InterviewPanel', () => {
  it('lists the skills your resume lacks and the German level the ad asks for', async () => {
    renderPanel();

    const gaps = await screen.findByRole('list', { name: 'Likely hard questions' });
    expect(within(gaps).getByText('graphql')).toBeInTheDocument();
    // react is in the resume, so it is no gap.
    expect(within(gaps).queryByText('react')).toBeNull();
    expect(screen.getByText(/asks for German B2/)).toBeInTheDocument();
  });

  it('says so when the resume covers everything, or there is no resume', async () => {
    server.use(
      api.query('JobInsights', () =>
        HttpResponse.json({
          data: {
            jobInsights: {
              ...INSIGHTS,
              germanRequired: false,
              skills: INSIGHTS.skills.map((s) => ({ ...s, inResume: true })),
            },
          },
        }),
      ),
    );
    renderPanel();
    expect(
      await screen.findByText('Your resume covers every skill the ad asks for.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/asks for German/)).toBeNull();
  });

  it('asks you to add a resume when there is none', async () => {
    server.use(
      api.query('JobInsights', () =>
        HttpResponse.json({
          data: {
            jobInsights: { ...INSIGHTS, hasResume: false, germanRequired: false, skills: [] },
          },
        }),
      ),
    );
    renderPanel();
    expect(await screen.findByText(/Add your resume on My profile/)).toBeInTheDocument();
  });

  it('copies the prompt and opens Claude, then saves the reply you paste', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Copy prompt and open Claude' }));
    expect(open).toHaveBeenCalledWith('https://claude.ai/new', '_blank', 'noopener');
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Interview prompt' }).value,
    ).toBe(INSIGHTS.interviewPrompt);

    // The box shows only when you ask for it.
    expect(screen.queryByRole('textbox', { name: 'Claude’s interview prep' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'or paste it in a box' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Claude’s interview prep' }),
      'GraphQL answers',
    );
    await user.click(screen.getByRole('button', { name: 'Save interview prep' }));

    expect(await screen.findByRole('region', { name: 'Saved interview prep' })).toHaveTextContent(
      'GraphQL answers',
    );
    expect(requests).toContainEqual({
      operation: 'SaveInterviewPrep',
      variables: { jobId: 'job-1', text: 'GraphQL answers' },
    });
    // The prompt and box give way to the saved text.
    expect(screen.queryByRole('textbox', { name: 'Claude’s interview prep' })).toBeNull();
    expect(screen.getByText(/^Saved /)).toBeInTheDocument();
  });

  it('saves the reply straight from the clipboard', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole('button', { name: 'Copy prompt and open Claude' });
    await navigator.clipboard.writeText('From the clipboard');

    await user.click(
      screen.getByRole('button', { name: 'Paste Claude’s reply from the clipboard' }),
    );

    expect(await screen.findByRole('region', { name: 'Saved interview prep' })).toHaveTextContent(
      'From the clipboard',
    );
  });

  it('shows the saved prep, lets you replace it and delete it', async () => {
    const user = userEvent.setup();
    interviewPrep.current = SAVED;
    renderPanel();

    const saved = await screen.findByRole('region', { name: 'Saved interview prep' });
    expect(saved).toHaveTextContent('1. What they care about');
    expect(screen.queryByRole('button', { name: 'Copy prompt and open Claude' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Replace' }));
    expect(screen.getByRole('button', { name: 'Copy prompt and open Claude' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'or paste it in a box' }));
    await user.type(screen.getByRole('textbox', { name: 'Claude’s interview prep' }), 'New');
    await user.click(screen.getByRole('button', { name: 'Save interview prep' }));
    expect(await screen.findByRole('region', { name: 'Saved interview prep' })).toHaveTextContent(
      'New',
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByRole('button', { name: 'Copy prompt and open Claude' }),
    ).toBeInTheDocument();
    expect(requests.map((r) => r.operation)).toContain('DeleteInterviewPrep');
  });

  it('splits the saved prep into tabs, with the questions as flash cards', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    interviewPrep.current = { text: FULL, updatedAt: SAVED.updatedAt };
    renderPanel();

    const tabs = await screen.findByRole('tablist', { name: 'Parts of your interview prep' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['What they want', 'About me', 'Questions0/2', 'My gaps', 'Ask them', 'Research']);

    // The answer stays hidden until you ask for it.
    const card = screen.getByRole('article', { name: 'Question 1 of 2' });
    expect(card).toHaveTextContent('How do you keep a React app fast?');
    expect(card).toHaveTextContent('Why they ask: the ad says Core Web Vitals.');
    expect(card).not.toHaveTextContent('I split the bundle');
    await user.click(within(card).getByRole('button', { name: 'Show answer' }));
    expect(card).toHaveTextContent('I split the bundle at Bank X.');

    // "I know it" counts it and moves on.
    await user.click(within(card).getByRole('button', { name: '✓ I know it' }));
    expect(screen.getByRole('article', { name: 'Question 2 of 2' })).toBeInTheDocument();
    expect(within(tabs).getByRole('tab', { name: /Questions/ })).toHaveTextContent('1/2');

    await user.click(within(tabs).getByRole('tab', { name: 'Ask them' }));
    expect(screen.getByRole('tabpanel', { name: 'Ask them' })).toHaveTextContent(
      'What does a good first month look like?',
    );
  });

  it('jumps from a gap chip to what to say about it', async () => {
    const user = userEvent.setup();
    interviewPrep.current = { text: FULL, updatedAt: SAVED.updatedAt };
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'graphql ›' }));
    const panel = screen.getByRole('tabpanel', { name: 'My gaps' });
    const gap = within(panel).getByText('GraphQL').closest('li');
    expect(gap).toHaveAttribute('aria-current', 'true');
    expect(gap).toHaveTextContent('Say: I used REST APIs');
    expect(gap).toHaveTextContent('Learn this week: the Apollo tutorial');
  });

  it('keeps research ticks for the job', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    interviewPrep.current = { text: FULL, updatedAt: SAVED.updatedAt };
    renderPanel();

    await user.click(await screen.findByRole('tab', { name: 'Research' }));
    await user.click(screen.getByRole('checkbox', { name: 'Read the About us page' }));
    expect(screen.getByRole('checkbox', { name: 'Read the About us page' })).toBeChecked();
    expect(JSON.parse(localStorage.getItem('interview.research.job-1') ?? '[]')).toEqual([
      'Read the About us page',
    ]);
  });

  it('copies a mock interview in German for a German job, or in English', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderPanel();

    await user.click(
      await screen.findByRole('button', { name: 'Copy mock interview and open Claude' }),
    );
    expect(await navigator.clipboard.readText()).toContain('in German');
    expect(open).toHaveBeenCalledWith('https://claude.ai/new', '_blank', 'noopener');

    await user.click(screen.getByRole('radio', { name: 'English' }));
    await user.click(screen.getByRole('button', { name: 'Copy mock interview and open Claude' }));
    expect(await navigator.clipboard.readText()).toBe("Let's do a mock interview.");
  });

  it('says why saving failed', async () => {
    const user = userEvent.setup();
    server.use(
      api.mutation('SaveInterviewPrep', () =>
        HttpResponse.json({
          errors: [
            {
              message: 'empty',
              extensions: { apiCode: 'INTERVIEW_PREP_EMPTY', apiParams: {} },
            },
          ],
        }),
      ),
    );
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'or paste it in a box' }));
    await user.type(screen.getByRole('textbox', { name: 'Claude’s interview prep' }), 'x');

    await user.click(screen.getByRole('button', { name: 'Save interview prep' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not do that: The interview prep is empty.',
    );
  });

  it('says when the job could not be loaded', async () => {
    server.use(
      api.query('JobInsights', () => HttpResponse.json({ errors: [{ message: 'boom' }] })),
    );
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this job');
  });
});
