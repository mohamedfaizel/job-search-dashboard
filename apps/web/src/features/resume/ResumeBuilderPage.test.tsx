import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from '../../test/navigation';
import { renderWithData } from '../profile/test/render';
import { requests, server } from '../profile/test/server';
import { ResumeBuilderPage } from './ResumeBuilderPage';
import { build, builderHandlers, lastSaved } from './test/server';

/** Autosave waits a second after the last change. */
const SAVE_WAIT = { timeout: 3000 };

async function renderBuilder() {
  server.use(...builderHandlers);
  const user = userEvent.setup();
  renderWithData(<ResumeBuilderPage />);
  await screen.findByRole('heading', { name: 'Resume builder' });
  return user;
}

const card = (title: string) => screen.getByRole('region', { name: title });

describe('Resume builder', () => {
  it('shows your resume as sections and saves a change on its own', async () => {
    const user = await renderBuilder();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada Lovelace');
    expect(
      screen
        .getAllByRole('textbox', { name: 'Section title' })
        .map((i) => (i as HTMLInputElement).value),
    ).toEqual(['Summary', 'Experience', 'Languages']);
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('✓ Saved');

    const bullet = within(card('Experience')).getByRole('textbox', { name: 'Bullet 2' });
    await user.clear(bullet);
    await user.type(bullet, 'Built the React design system');
    expect(screen.getByText('Not saved yet')).toBeInTheDocument();

    await waitFor(() => {
      expect(lastSaved()?.sections[1]?.blocks[0]).toMatchObject({
        bullets: ['Cut load time by 40%', 'Built the React design system'],
      });
    }, SAVE_WAIT);
    // One save for the whole burst of typing, not one per key.
    expect(requests.filter((r) => r.operation === 'SaveResumeBuild')).toHaveLength(1);
    expect(await screen.findByText('✓ Saved')).toBeInTheDocument();
  });

  it('shows the PDF pages against your page limit', async () => {
    build.pages = 3;
    await renderBuilder();
    const meter = await screen.findByRole('meter', { name: 'Pages used' });
    await waitFor(() => {
      expect(meter).toHaveAttribute('aria-valuetext', '3 of 2');
    });
    expect(screen.getByText(/Longer than your page limit of 2/)).toBeInTheDocument();
  });

  it('hides, moves and deletes sections, and Undo brings them back', async () => {
    const user = await renderBuilder();
    await user.click(screen.getByRole('button', { name: 'Hide Summary from the PDF and prompts' }));
    expect(within(card('Summary')).getByText('Hidden')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Move Summary down' }));
    expect(
      screen
        .getAllByRole('textbox', { name: 'Section title' })
        .map((i) => (i as HTMLInputElement).value),
    ).toEqual(['Experience', 'Summary', 'Languages']);

    await user.click(screen.getByRole('button', { name: 'Delete Experience' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Delete Experience' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(screen.queryByRole('region', { name: 'Experience' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /Undo/ }));
    expect(card('Experience')).toBeInTheDocument();

    await waitFor(() => {
      const saved = lastSaved();
      expect(saved?.sections.map((s) => [s.title, s.hidden])).toEqual([
        ['Experience', false],
        ['Summary', true],
        ['Languages', false],
      ]);
    }, SAVE_WAIT);
  });

  it('adds a section titled in the resume language and a new bullet with Enter', async () => {
    const user = await renderBuilder();
    await user.click(screen.getByRole('button', { name: '+ Add section' }));
    await user.click(screen.getByRole('button', { name: 'Projects' }));
    const projects = card('Projects');
    await user.type(within(projects).getByRole('textbox', { name: 'Title' }), 'Job search app');
    const first = within(projects).getByRole('textbox', { name: 'Bullet 1' });
    await user.type(first, 'Built it{Enter}Shipped it');
    expect(within(projects).getByRole('textbox', { name: 'Bullet 2' })).toHaveValue('Shipped it');
    expect(within(projects).getByRole('textbox', { name: 'Bullet 2' })).toHaveFocus();
  });

  it('keeps Languages locked to My profile', async () => {
    await renderBuilder();
    const languages = card('Languages');
    expect(within(languages).getByText('German A2')).toBeInTheDocument();
    expect(within(languages).queryByRole('textbox', { name: /Bullet/ })).toBeNull();
    expect(
      within(languages).getByRole('link', { name: 'Change them on My profile' }),
    ).toHaveAttribute('href', '/profile');
  });

  it('offers to read a new upload into sections', async () => {
    build.current = { ...build.current, outOfDate: true };
    const user = await renderBuilder();
    await user.click(screen.getByRole('button', { name: 'Read the new resume' }));
    expect(requests).toContainEqual({
      operation: 'RestartResumeBuild',
      variables: { language: 'en' },
    });
    expect(await screen.findByDisplayValue('Ada from the upload')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Read the new resume' })).toBeNull();
  });

  it('switches to your German resume', async () => {
    const user = await renderBuilder();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Resume language' }), 'lang:de');
    expect(router.replace).toHaveBeenCalledWith('/resume?language=de');
    await waitFor(() => {
      expect(requests).toContainEqual({ operation: 'ResumeBuild', variables: { language: 'de' } });
    });
  });

  it('has a Design tab next to the content whose changes make a new PDF', async () => {
    const user = await renderBuilder();
    await waitFor(() => {
      expect(requests.filter((r) => r.operation === 'ResumePdf')).toHaveLength(1);
    });
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    expect(router.replace).toHaveBeenCalledWith('/resume?tab=look');
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    // The content stays on screen: no step to switch back to.
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeVisible();

    const template = await screen.findByRole(
      'combobox',
      { name: 'Resume template' },
      { timeout: 5000 },
    );
    await waitFor(() => {
      expect(template).toHaveValue('classic');
    });
    await user.selectOptions(template, 'modern');
    await waitFor(() => {
      expect(requests.filter((r) => r.operation === 'ResumePdf')).toHaveLength(2);
    }, SAVE_WAIT);

    await user.click(screen.getByRole('tab', { name: 'Text' }));
    expect(router.replace).toHaveBeenLastCalledWith('/resume');
  });

  it('has one screen with a toolbar instead of steps; the PDF button downloads', async () => {
    await renderBuilder();
    expect(screen.queryByRole('navigation', { name: 'Steps' })).toBeNull();
    const tools = screen.getByRole('tablist', { name: 'Resume tools' });
    expect(
      within(tools)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Text', 'Design', 'Setup']);
    expect(screen.getByRole('toolbar', { name: 'Format text' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '⬇ PDF' })).toHaveAttribute(
      'href',
      expect.stringContaining('download=1'),
    );
  });

  it('shows the setup at a glance and opens it in the Setup tab', async () => {
    const user = await renderBuilder();
    expect(await screen.findByText('All resumes: 2 pages')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Master resume' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Setup' }));
    expect(router.replace).toHaveBeenCalledWith('/resume?tab=files');
    expect(await screen.findByRole('heading', { name: 'Master resume' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'For all resumes' })).toBeInTheDocument();
  });

  it('opens Setup for an old Resume Settings link', async () => {
    window.history.pushState({}, '', '/resume?tab=files');
    await renderBuilder();
    expect(await screen.findByRole('heading', { name: 'Master resume' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Setup' })).toHaveAttribute('aria-selected', 'true');
    window.history.pushState({}, '', '/resume');
  });
});
