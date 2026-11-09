import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { requests, server } from '../../profile/test/server';
import { ResumeBuilderPage } from '../ResumeBuilderPage';
import { builderHandlers, jobBuild, jobBuilderHandlers } from '../test/server';
import { fillTemplate } from './LetterPanel';

const SAVE_WAIT = { timeout: 3000 };

describe('Cover letter template', () => {
  it('is written once on its own page, saved on its own, with its PDF', async () => {
    window.history.pushState({}, '', '/resume?letter=en');
    server.use(...builderHandlers);
    const user = userEvent.setup();
    renderWithData(<ResumeBuilderPage />);
    const panel = await screen.findByRole('region', { name: 'Cover letter template' });
    expect(within(panel).getByText(/No template yet/)).toBeInTheDocument();
    // A template has no job, so there is no "Write with AI".
    expect(within(panel).queryByRole('button', { name: /with AI/ })).toBeNull();
    expect(within(panel).getByText(/Type \{company\} and \{job\}/)).toBeInTheDocument();
    const switcher = screen.getByRole('combobox', { name: 'Resume' });
    expect(switcher).toHaveValue('letter:en');

    await user.click(within(panel).getByRole('button', { name: /Add paragraph/ }));
    await user.type(
      within(panel).getByRole('textbox', { name: 'Paragraph 1' }),
      'Dear {{company} team,',
    );
    await waitFor(() => {
      expect(requests.filter((r) => r.operation === 'SaveCoverLetterTemplate').at(-1)).toEqual({
        operation: 'SaveCoverLetterTemplate',
        variables: { language: 'en', text: 'Dear {company} team,' },
      });
    }, SAVE_WAIT);
    await waitFor(() => {
      expect(requests.some((r) => r.operation === 'TemplatePdf')).toBe(true);
    });
  });

  it('opens your resume from the switcher', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign, search: '?letter=en', pathname: '/resume' });
    server.use(...builderHandlers);
    const user = userEvent.setup();
    renderWithData(<ResumeBuilderPage />);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Resume' }), 'lang:en');
    expect(assign).toHaveBeenCalledWith('/resume?language=en');
    vi.unstubAllGlobals();
  });

  it('starts an empty job letter from the template, with the job filled in', async () => {
    jobBuild.current = { ...jobBuild.current, hasCopy: true };
    jobBuild.template = 'Dear {company} team,\n\nI want the {JOB} role.';
    window.history.pushState({}, '', '/resume?job=j1&tab=letter');
    server.use(...jobBuilderHandlers);
    const user = userEvent.setup();
    renderWithData(<ResumeBuilderPage />);
    const panel = await screen.findByRole('region', { name: 'Cover letter' });
    await user.click(await within(panel).findByRole('button', { name: 'Start from my template' }));
    expect(within(panel).getByRole('textbox', { name: 'Paragraph 1' })).toHaveValue(
      'Dear Acme GmbH team,',
    );
    await waitFor(() => {
      expect(jobBuild.letter).toBe('Dear Acme GmbH team,\n\nI want the Frontend Engineer role.');
    }, SAVE_WAIT);
  });

  it('offers no template button when there is no template', async () => {
    jobBuild.current = { ...jobBuild.current, hasCopy: true };
    window.history.pushState({}, '', '/resume?job=j1&tab=letter');
    server.use(...jobBuilderHandlers);
    renderWithData(<ResumeBuilderPage />);
    const panel = await screen.findByRole('region', { name: 'Cover letter' });
    await waitFor(() => {
      expect(requests.some((r) => r.operation === 'CoverLetterTemplate')).toBe(true);
    });
    expect(within(panel).queryByRole('button', { name: 'Start from my template' })).toBeNull();
  });

  it('fills {company} and {job} in any case', () => {
    expect(fillTemplate('{Company} / {job} / {JOB}', { company: 'Acme', title: 'Dev' })).toBe(
      'Acme / Dev / Dev',
    );
  });
});
