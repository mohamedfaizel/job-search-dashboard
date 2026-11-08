import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { requests, server } from '../../profile/test/server';
import { ResumeBuilderPage } from '../ResumeBuilderPage';
import { builderHandlers, jobBuild, jobBuilderHandlers } from '../test/server';

const SAVE_WAIT = { timeout: 3000 };

const saves = () => requests.filter((r) => r.operation === 'SaveJobCoverLetter');
const lastText = () => saves().at(-1)?.variables['text'];

async function renderLetter(letter = 'Dear team,\n\nI like this role.\n\nAda') {
  jobBuild.current = { ...jobBuild.current, hasCopy: true };
  jobBuild.letter = letter;
  window.history.pushState({}, '', '/resume?job=j1&tab=letter');
  server.use(...jobBuilderHandlers);
  const user = userEvent.setup();
  renderWithData(<ResumeBuilderPage />);
  const panel = await screen.findByRole('region', { name: 'Cover letter' });
  return { user, panel };
}

describe('Cover letter tab', () => {
  it('shows the letter by paragraph, saves edits on its own and shows the PDF', async () => {
    const { user, panel } = await renderLetter();
    const first = await within(panel).findByRole('textbox', { name: 'Paragraph 1' });
    expect(first).toHaveValue('Dear team,');
    expect(within(panel).getByText('7 words')).toBeInTheDocument();
    // The letter's own PDF is shown, against a one-page limit.
    await waitFor(() => {
      expect(requests.some((r) => r.operation === 'JobLetterPdf')).toBe(true);
    });
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuemax', '1');

    await user.type(within(panel).getByRole('textbox', { name: 'Paragraph 2' }), ' A lot.');
    expect(within(panel).getByText('Not saved yet')).toBeInTheDocument();
    await waitFor(() => {
      expect(lastText()).toBe('Dear team,\n\nI like this role. A lot.\n\nAda');
    }, SAVE_WAIT);
    expect(await within(panel).findByText('✓ Letter saved')).toBeInTheDocument();
    // The resume is not touched by the letter.
    expect(requests.some((r) => r.operation === 'SaveJobResumeBuild')).toBe(false);
  });

  it('adds, moves and deletes paragraphs', async () => {
    const { user, panel } = await renderLetter();
    await within(panel).findByRole('textbox', { name: 'Paragraph 3' });
    await user.click(within(panel).getByRole('button', { name: 'Move paragraph 3 up' }));
    await waitFor(() => {
      expect(lastText()).toBe('Dear team,\n\nAda\n\nI like this role.');
    }, SAVE_WAIT);
    await user.click(within(panel).getByRole('button', { name: 'Delete paragraph 1' }));
    await waitFor(() => {
      expect(lastText()).toBe('Ada\n\nI like this role.');
    }, SAVE_WAIT);
    await user.click(within(panel).getByRole('button', { name: /Add paragraph/ }));
    await user.type(within(panel).getByRole('textbox', { name: 'Paragraph 3' }), 'Thanks!');
    await waitFor(() => {
      expect(lastText()).toBe('Ada\n\nI like this role.\n\nThanks!');
    }, SAVE_WAIT);
  });

  it('writes a first letter with AI, shows it first and keeps it', async () => {
    const { user, panel } = await renderLetter('');
    expect(within(panel).getByText(/No cover letter for this job yet/)).toBeInTheDocument();
    expect(screen.getByText('Write your letter to see the PDF')).toBeInTheDocument();
    expect(requests.some((r) => r.operation === 'JobLetterPdf')).toBe(false);

    await user.click(within(panel).getByRole('button', { name: /Write with AI/ }));
    const flow = within(panel).getByRole('region', { name: 'Write a cover letter with AI' });
    await user.type(within(flow).getByRole('textbox', { name: /What should change/ }), 'warm');
    await user.click(within(flow).getByRole('button', { name: /Copy prompt and open Claude/ }));
    expect(await navigator.clipboard.readText()).toBe('Please write my letter.');
    expect(requests).toContainEqual({
      operation: 'ImproveLetterPrompt',
      variables: { input: { jobId: 'j1', instruction: 'warm' } },
    });

    await user.click(within(flow).getByRole('textbox', { name: 'Claude’s reply' }));
    await user.paste('Dear team,\n\nI raised sales by 90%.\n\nAda');
    await user.click(within(flow).getByRole('button', { name: 'Show the changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('90%');
    // Nothing is saved until you keep it.
    expect(saves()).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Keep the changes' }));
    expect(await within(panel).findByRole('textbox', { name: 'Paragraph 2' })).toHaveValue(
      'I raised sales by 90%.',
    );
    await waitFor(() => {
      expect(lastText()).toBe('Dear team,\n\nI raised sales by 90%.\n\nAda');
    }, SAVE_WAIT);
  });

  it('improves the letter you have, and discard keeps it as it is', async () => {
    const { user, panel } = await renderLetter();
    await user.click(within(panel).getByRole('button', { name: /Improve with AI/ }));
    const flow = within(panel).getByRole('region', { name: 'Improve this cover letter with AI' });
    await user.click(within(flow).getByRole('textbox', { name: 'Claude’s reply' }));
    await user.paste('Dear team,\n\nShorter.\n\nAda');
    await user.click(within(flow).getByRole('button', { name: 'Show the changes' }));
    await screen.findByRole('region', { name: 'Changes' });
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(within(panel).getByRole('textbox', { name: 'Paragraph 2' })).toHaveValue(
      'I like this role.',
    );
    expect(saves()).toHaveLength(0);
  });

  it('is only there for a job’s resume copy', async () => {
    window.history.pushState({}, '', '/resume');
    server.use(...builderHandlers);
    renderWithData(<ResumeBuilderPage />);
    await screen.findByRole('heading', { name: 'Resume builder' });
    expect(screen.queryByRole('tab', { name: 'Cover letter' })).not.toBeInTheDocument();
  });
});
