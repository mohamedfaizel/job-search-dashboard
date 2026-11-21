import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { router } from '../../test/navigation';
import { renderWithData } from '../profile/test/render';
import { api, ME, requests, server } from '../profile/test/server';
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

  it('folds the text and design tools on a phone, and opens them on a tap', async () => {
    // jsdom has no matchMedia (so tests get the desktop); this one says "phone".
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })),
    );
    try {
      const user = await renderBuilder();
      expect(screen.queryByRole('group', { name: 'Resume tools' })).not.toBeInTheDocument();
      // The resume itself is right there.
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada Lovelace');
      const toggle = screen.getByRole('button', { name: 'Text and design' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('group', { name: 'Resume tools' })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('says the preview is the plain PDF, with the start command for admins only', async () => {
    build.styled = false;
    await renderBuilder();
    expect(
      await screen.findByText(
        'This is the plain PDF. Your template shows here again when PDF templates are back.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/pnpm/)).toBeNull();
  });

  it('shows admins how to start the PDF maker when the preview is plain', async () => {
    build.styled = false;
    server.use(
      api.query('Me', () => HttpResponse.json({ data: { me: { ...ME, role: 'ADMIN' } } })),
    );
    await renderBuilder();
    expect(await screen.findByText(/Start the PDF box \(pnpm pdf:up\)/)).toBeInTheDocument();
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

  it('has the look in the tool row next to the content, and its changes make a new PDF', async () => {
    const user = await renderBuilder();
    await waitFor(() => {
      expect(requests.filter((r) => r.operation === 'ResumePdf')).toHaveLength(1);
    });
    const tools = screen.getByRole('group', { name: 'Resume tools' });
    const template = await within(tools).findByRole(
      'combobox',
      { name: 'Resume template' },
      { timeout: 5000 },
    );
    await waitFor(() => {
      expect(template).toHaveValue('classic');
    });
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeVisible();
    await user.selectOptions(template, 'modern');
    await waitFor(() => {
      expect(requests.filter((r) => r.operation === 'ResumePdf')).toHaveLength(2);
    }, SAVE_WAIT);

    // Size and spacing, and the rest of the look, open under their buttons.
    await user.click(within(tools).getByRole('button', { name: /Size and spacing/ }));
    expect(screen.getByRole('slider', { name: 'Text size' })).toBeVisible();
    await user.click(within(tools).getByRole('button', { name: /More design/ }));
    expect(screen.queryByRole('slider', { name: 'Text size' })).toBeNull();
    expect(screen.getByText('Show my photo on the resume')).toBeVisible();
  });

  it('has one tool row instead of tabs or steps; the PDF button downloads', async () => {
    await renderBuilder();
    expect(screen.queryByRole('navigation', { name: 'Steps' })).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    const tools = screen.getByRole('group', { name: 'Resume tools' });
    expect(within(tools).getByRole('toolbar', { name: 'Format text' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '⬇ PDF' })).toHaveAttribute(
      'href',
      expect.stringContaining('download=1'),
    );
  });

  it('shows the setup at a glance and opens it in a panel on the right', async () => {
    const user = await renderBuilder();
    expect(await screen.findByText('All resumes: 2 pages')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Setup' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '⚙ Setup' }));
    expect(router.replace).toHaveBeenCalledWith('/resume?tab=files');
    const panel = screen.getByRole('dialog', { name: 'Setup' });
    expect(
      await within(panel).findByRole('heading', { name: 'Master resume' }),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('region', { name: 'For all resumes' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Setup' })).toBeNull();
    expect(router.replace).toHaveBeenLastCalledWith('/resume');
  });

  it('opens Setup from "+ Add a resume in another language"', async () => {
    const user = await renderBuilder();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Resume language' }), 'add:');
    expect(screen.getByRole('dialog', { name: 'Setup' })).toBeInTheDocument();
  });

  it('opens Setup for an old Resume Settings link', async () => {
    window.history.pushState({}, '', '/resume?tab=files');
    await renderBuilder();
    const panel = screen.getByRole('dialog', { name: 'Setup' });
    expect(
      await within(panel).findByRole('heading', { name: 'Master resume' }),
    ).toBeInTheDocument();
    window.history.pushState({}, '', '/resume');
  });
});
