import type { BuilderDoc } from '@jobsearch/data';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { apiKeys, requests, server } from '../../profile/test/server';
import { ResumeBuilderPage } from '../ResumeBuilderPage';
import { builderHandlers, jobBuild, jobBuilderHandlers, lastSaved } from '../test/server';

const SAVE_WAIT = { timeout: 3000 };

const card = (title: string) => screen.getByRole('region', { name: title });
const improve = () => requests.filter((r) => r.operation === 'ImproveSection');

async function renderMaster() {
  window.history.pushState({}, '', '/resume');
  server.use(...builderHandlers);
  const user = userEvent.setup();
  renderWithData(<ResumeBuilderPage />);
  await screen.findByRole('heading', { name: 'Resume builder' });
  return user;
}

async function openImprove(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Improve Experience with AI' }));
  return within(card('Experience')).getByRole('region', { name: 'Improve this section with AI' });
}

describe('Improve a section with AI', () => {
  it('copies the prompt, reads the pasted reply as before and after, and keeps it', async () => {
    const user = await renderMaster();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const panel = await openImprove(user);

    await user.type(within(panel).getByRole('textbox', { name: /What should change/ }), 'shorter');
    await user.click(within(panel).getByRole('button', { name: /Copy prompt and open Claude/ }));
    expect(await navigator.clipboard.readText()).toBe('Please improve my section.');
    expect(open).toHaveBeenCalledWith('https://claude.ai/new', '_blank', 'noopener');
    expect(requests).toContainEqual({
      operation: 'ImproveSectionPrompt',
      variables: {
        input: { sectionId: 'exp', jobId: null, language: 'en', instruction: 'shorter' },
      },
    });

    await user.click(within(panel).getByRole('textbox', { name: 'Claude’s reply' }));
    await user.paste('- Cut load time by 40%\n- Led the design system');
    await user.click(within(panel).getByRole('button', { name: 'Show the changes' }));

    const changes = await screen.findByRole('region', { name: 'Changes' });
    expect(within(changes).getByText(/Built the design system/)).toBeInTheDocument();
    expect(within(changes).getByText(/Led the design system/)).toBeInTheDocument();
    expect(within(changes).getAllByText('Removed:').length).toBeGreaterThan(0);
    expect(within(changes).getAllByText('Added:').length).toBeGreaterThan(0);
    expect(within(changes).getByRole('status')).toHaveTextContent('Every number, skill and level');
    // Nothing changed yet.
    expect(within(card('Experience')).queryByRole('textbox', { name: 'Bullet 2' })).toHaveValue(
      'Built the design system',
    );

    await user.click(within(changes).getByRole('button', { name: 'Keep the changes' }));
    expect(screen.queryByRole('region', { name: 'Changes' })).not.toBeInTheDocument();
    expect(
      await within(card('Experience')).findByRole('textbox', { name: 'Bullet 2' }),
    ).toHaveValue('Led the design system');
    await waitFor(() => {
      expect(lastSaved()?.sections[1]).toMatchObject({
        id: 'exp',
        blocks: [{ kind: 'bullets', items: ['Cut load time by 40%', 'Led the design system'] }],
      });
    }, SAVE_WAIT);
  });

  it('flags what is not in anything you told us, and discard changes nothing', async () => {
    const user = await renderMaster();
    const panel = await openImprove(user);
    await user.click(within(panel).getByRole('textbox', { name: 'Claude’s reply' }));
    await user.paste('- Raised sales by 90%');
    await user.click(within(panel).getByRole('button', { name: 'Show the changes' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('1 thing is not in anything you told us');
    expect(alert).toHaveTextContent('90%');
    expect(alert).toHaveTextContent('Raised sales by 90%');

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('region', { name: 'Changes' })).not.toBeInTheDocument();
    expect(within(card('Experience')).getByRole('textbox', { name: 'Bullet 2' })).toHaveValue(
      'Built the design system',
    );
    expect(requests.some((r) => r.operation === 'SaveResumeBuild')).toBe(false);
  });

  it('asks your own key when you have one, and needs one first', async () => {
    const user = await renderMaster();
    let panel = await openImprove(user);
    expect(within(panel).getByRole('button', { name: /Improve with my key/ })).toBeDisabled();
    expect(within(panel).getByRole('link', { name: 'Add a key in Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    await user.click(within(panel).getByRole('button', { name: 'Close' }));

    apiKeys.push({ kind: 'ANTHROPIC', last4: '1234', model: null, credits: null, updatedAt: '' });
    // The saved keys load again when the panel opens.
    panel = await openImprove(user);
    const button = within(panel).getByRole('button', { name: /Improve with my key/ });
    await waitFor(() => {
      expect(button).toBeEnabled();
    });
    await user.click(button);

    expect(await screen.findByRole('region', { name: 'Changes' })).toBeInTheDocument();
    expect(improve().at(-1)?.variables['input']).toMatchObject({ sectionId: 'exp', reply: null });
  });

  it('works on a job’s copy and tells the server which job', async () => {
    jobBuild.current = { ...jobBuild.current, hasCopy: true };
    window.history.pushState({}, '', '/resume?job=j1');
    server.use(...jobBuilderHandlers);
    const user = userEvent.setup();
    renderWithData(<ResumeBuilderPage />);
    await screen.findByRole('textbox', { name: 'Name' });
    const panel = await openImprove(user);
    await user.click(within(panel).getByRole('textbox', { name: 'Claude’s reply' }));
    await user.paste('- Cut load time by 40%');
    await user.click(within(panel).getByRole('button', { name: 'Show the changes' }));
    await screen.findByRole('region', { name: 'Changes' });
    expect(improve().at(-1)?.variables['input']).toMatchObject({ jobId: 'j1', sectionId: 'exp' });
    await user.click(screen.getByRole('button', { name: 'Keep the changes' }));
    await waitFor(() => {
      const saved = requests.filter((r) => r.operation === 'SaveJobResumeBuild').at(-1);
      expect(JSON.parse(saved?.variables['doc'] as string) as BuilderDoc).toMatchObject({
        sections: [{}, { blocks: [{ items: ['Cut load time by 40%'] }] }, {}],
      });
    }, SAVE_WAIT);
  });

  it('has no Improve button on the locked Languages section', async () => {
    await renderMaster();
    expect(
      screen.queryByRole('button', { name: 'Improve Languages with AI' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Improve Summary with AI' })).toBeInTheDocument();
  });
});

describe('Check tab', () => {
  it('lists facts that are in no source, and the PDF check', async () => {
    jobBuild.current = { ...jobBuild.current, hasCopy: true };
    jobBuild.facts = [
      { kind: 'NUMBER', text: '40%', where: 'RESUME', context: 'Cut load time by 40%' },
    ];
    window.history.pushState({}, '', '/resume?job=j1&tab=check');
    server.use(...jobBuilderHandlers);
    renderWithData(<ResumeBuilderPage />);

    const panel = await screen.findByRole('region', { name: 'Check this resume' });
    expect(await within(panel).findByText('40%')).toBeInTheDocument();
    expect(
      within(panel).getByText(/In this resume but in nothing you told us/),
    ).toBeInTheDocument();
    expect(await within(panel).findByText(/3 pages/)).toBeInTheDocument();
    expect(requests).toContainEqual({
      operation: 'ResumePdfCheck',
      variables: { jobId: 'j1', template: null },
    });
  });

  it('says all is well when every fact is in your sources, and only exists for a job', async () => {
    jobBuild.current = { ...jobBuild.current, hasCopy: true };
    window.history.pushState({}, '', '/resume?job=j1&tab=check');
    server.use(...jobBuilderHandlers);
    renderWithData(<ResumeBuilderPage />);
    const panel = await screen.findByRole('region', { name: 'Check this resume' });
    expect(
      await within(panel).findByText(/Every number, skill and level is in your master/),
    ).toBeInTheDocument();
  });

  it('is not offered for the master resume', async () => {
    await renderMaster();
    expect(screen.queryByRole('tab', { name: 'Check' })).not.toBeInTheDocument();
  });
});
