import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { requests, server } from '../../profile/test/server';
import { ResumeBuilderPage } from '../ResumeBuilderPage';
import { builderHandlers, lastSaved } from '../test/server';

const SAVE_WAIT = { timeout: 3000 };

async function renderBuilder() {
  server.use(...builderHandlers);
  const user = userEvent.setup();
  renderWithData(<ResumeBuilderPage />);
  await screen.findByRole('heading', { name: 'Resume builder' });
  return user;
}

const card = (title: string) => screen.getByRole('region', { name: title });
const titles = () =>
  screen
    .getAllByRole('textbox', { name: 'Section title' })
    .map((i) => (i as HTMLInputElement).value);

/** jsdom has no DataTransfer; the drag only needs these. */
const dataTransfer = (data: Record<string, string> = {}) => ({
  effectAllowed: '',
  types: Object.keys(data),
  getData: (type: string) => data[type] ?? '',
  setData: vi.fn(),
  setDragImage: vi.fn(),
});

describe('Resume builder parts', () => {
  it('moves a section by dragging its grip onto another card', async () => {
    await renderBuilder();
    const grips = document.querySelectorAll('[draggable="true"]');
    // The first draggable grip in a section card header is Summary's.
    const summaryGrip = within(card('Summary')).getAllByTitle('Drag to move')[0] as HTMLElement;
    expect(grips.length).toBeGreaterThan(0);
    fireEvent.dragStart(summaryGrip, { dataTransfer: dataTransfer() });
    fireEvent.dragOver(card('Languages'), { dataTransfer: dataTransfer() });
    expect(card('Languages').className).toContain('ring-flag-gold');
    fireEvent.drop(card('Languages'), { dataTransfer: dataTransfer() });
    fireEvent.dragEnd(summaryGrip);
    expect(titles()).toEqual(['Experience', 'Languages', 'Summary']);
  });

  it('reorders bullets by dragging, and keeps drags inside their list', async () => {
    await renderBuilder();
    const experience = card('Experience');
    const grips = within(experience).getAllByTitle('Drag to move');
    // [section grip, bullet 1, bullet 2]
    const bulletRows = within(experience).getAllByRole('listitem');
    fireEvent.dragStart(grips[2] as HTMLElement, { dataTransfer: dataTransfer() });
    // A section card ignores a bullet's drag.
    fireEvent.drop(card('Summary'), { dataTransfer: dataTransfer() });
    expect(titles()).toEqual(['Summary', 'Experience', 'Languages']);
    fireEvent.dragOver(bulletRows[0] as HTMLElement, { dataTransfer: dataTransfer() });
    fireEvent.dragLeave(bulletRows[0] as HTMLElement);
    fireEvent.drop(bulletRows[0] as HTMLElement, { dataTransfer: dataTransfer() });
    expect(within(experience).getByRole('textbox', { name: 'Bullet 1' })).toHaveValue(
      'Built the design system',
    );
  });

  it('edits lines with the keyboard: Alt+arrows move, Backspace on empty removes', async () => {
    const user = await renderBuilder();
    const experience = card('Experience');
    await user.click(within(experience).getByRole('textbox', { name: 'Bullet 1' }));
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(within(experience).getByRole('textbox', { name: 'Bullet 2' })).toHaveValue(
      'Cut load time by 40%',
    );
    expect(within(experience).getByRole('textbox', { name: 'Bullet 2' })).toHaveFocus();

    await user.click(within(experience).getByRole('button', { name: '+ Add bullet' }));
    const third = within(experience).getByRole('textbox', { name: 'Bullet 3' });
    expect(third).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(within(experience).queryByRole('textbox', { name: 'Bullet 3' })).toBeNull();

    await user.click(within(experience).getByRole('button', { name: 'Remove Bullet 1' }));
    expect(within(experience).getAllByRole('textbox', { name: /^Bullet/ })).toHaveLength(1);
  });

  it('edits the header, a paragraph and an entry, and saves them', async () => {
    const user = await renderBuilder();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Ada King');
    await user.type(screen.getByRole('textbox', { name: 'Headline' }), ' (React)');
    await user.type(screen.getByRole('textbox', { name: 'Contact detail 2' }), '{Enter}+49 151');
    await user.type(within(card('Summary')).getByRole('textbox', { name: 'Text' }), ' Fast.');
    const place = within(card('Experience')).getByRole('textbox', { name: 'Place and dates' });
    await user.clear(place);
    await user.type(place, 'Remote | 2021 - today');

    await waitFor(() => {
      const saved = lastSaved();
      expect(saved).toMatchObject({
        name: 'Ada King',
        headline: 'Frontend Engineer (React)',
        contact: ['Berlin', 'ada@example.com', '+49 151'],
      });
      expect(saved?.sections[0]?.blocks[0]).toMatchObject({ text: 'Engineer who ships. Fast.' });
      expect(saved?.sections[1]?.blocks[0]).toMatchObject({ meta: 'Remote | 2021 - today' });
    }, SAVE_WAIT);
  });

  it('adds, moves and deletes blocks, and duplicates a section', async () => {
    const user = await renderBuilder();
    const summary = card('Summary');
    await user.click(within(summary).getByRole('button', { name: '+ Bullet list' }));
    await user.click(within(summary).getByRole('button', { name: 'Move part 2 of Summary up' }));
    expect(within(summary).getAllByRole('textbox')[1]).toHaveAccessibleName('Bullet 1');
    await user.click(within(summary).getByRole('button', { name: 'Move part 1 of Summary down' }));
    await user.click(within(summary).getByRole('button', { name: 'Delete part 2 of Summary' }));
    expect(within(summary).queryByRole('textbox', { name: 'Bullet 1' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Duplicate Summary' }));
    expect(titles()).toEqual(['Summary', 'Summary (copy)', 'Experience', 'Languages']);
    await user.click(screen.getByRole('button', { name: /Undo/ }));
    await user.click(screen.getByRole('button', { name: /Redo/ }));
    expect(titles()).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: 'Delete Experience' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(card('Experience')).toBeInTheDocument();
  });

  it('reads the resume with the AI chat prompt and the pasted reply', async () => {
    const user = await renderBuilder();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: /Sort with my AI chat/ }));
    await user.click(screen.getByRole('button', { name: 'Copy prompt and open Claude' }));
    expect(await screen.findByText('Copied. Paste it into Claude.')).toBeInTheDocument();
    expect(write).toHaveBeenCalledWith('Please put my resume into the layout');
    expect(open).toHaveBeenCalledWith('https://claude.ai/new', '_blank', 'noopener');

    await user.type(screen.getByRole('textbox', { name: 'Claude’s reply' }), '# Ada');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(requests).toContainEqual({
      operation: 'RestartResumeBuild',
      variables: { language: 'en', reply: '# Ada' },
    });
    expect(await screen.findByDisplayValue('Ada from the upload')).toBeInTheDocument();
  });

  it('starts again from My profile only after you confirm', async () => {
    const user = await renderBuilder();
    await user.click(screen.getByRole('button', { name: 'Start again from My profile' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Start again from My profile' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(requests.some((r) => r.operation === 'RestartResumeBuild')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Start again from My profile' }));
    await user.click(screen.getByRole('button', { name: 'Replace' }));
    expect(await screen.findByDisplayValue('Ada from the upload')).toBeInTheDocument();
    // Undo brings the builder's version back.
    await user.click(screen.getByRole('button', { name: /Undo/ }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada Lovelace');
  });

  it('keeps the builder version after a new upload when you say so', async () => {
    const { build } = await import('../test/server');
    build.current = { ...build.current, outOfDate: true };
    const user = await renderBuilder();
    await user.click(screen.getByRole('button', { name: 'Keep the builder’s version' }));
    await waitFor(() => {
      expect(lastSaved()?.name).toBe('Ada Lovelace');
    });
    expect(screen.queryByRole('button', { name: 'Keep the builder’s version' })).toBeNull();
  });

  it('shows the phone preview when you switch to it', async () => {
    const user = await renderBuilder();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-pressed', 'true');
  });
});
