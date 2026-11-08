import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { requests, SAVED_DESIGN, wordTemplate } from '../../profile/test/server';
import { LookPanel } from './LookPanel';

/** Changes save half a second after the last one. */
const SAVE_WAIT = { timeout: 3000 };

async function renderLook() {
  const user = userEvent.setup();
  const onSaved = vi.fn();
  renderWithData(<LookPanel onSaved={onSaved} />);
  // Style and templates load first: on a cold CI runner that can take over a second.
  await screen.findByRole('radio', { name: /Modern/ }, { timeout: 5000 });
  return { user, onSaved };
}

const updates = () => requests.filter((r) => r.operation === 'UpdateDocumentStyle');
const lastInput = () => updates().at(-1)?.variables['input'] as Record<string, unknown>;

describe('Look tab', () => {
  it('saves the template, colour, type and letter layout on its own', async () => {
    const { user, onSaved } = await renderLook();
    expect(screen.getByRole('radio', { name: /Classic/ })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: /Modern/ }));
    await user.click(screen.getByRole('radio', { name: 'Teal' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'serif');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cover letter layout' }), 'din');

    await waitFor(() => {
      expect(lastInput()).toEqual({
        resumeTemplate: 'modern',
        coverLetterLayout: 'din',
        accentColor: '0E7C66',
        font: 'serif',
        showPhoto: false,
        fontSize: null,
        margin: null,
        lineSpacing: 1,
        compact: false,
        skillsStyle: 'index',
        skillsBold: true,
        headingStyle: 'auto',
        datesSide: 'auto',
        bulletStyle: 'dot',
      });
    }, SAVE_WAIT);
    // One save for the quick burst of changes, then the PDF is made again.
    expect(updates()).toHaveLength(1);
    expect(onSaved).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
  });

  it('sets text size, margins, line spacing and compact mode, and goes back to the template', async () => {
    const { user } = await renderLook();
    const size = screen.getByRole('slider', { name: 'Text size' });
    // Before you move it, the slider sits on the template's own size.
    expect(size).toHaveValue('11');
    expect(size).toHaveAttribute('aria-valuetext', '11 pt (template)');
    expect(screen.getByRole('button', { name: 'Back to the template’s own' })).toBeDisabled();

    fireEvent.change(size, { target: { value: '10' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Margins' }), { target: { value: '14' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Line spacing' }), {
      target: { value: '1.15' },
    });
    await user.click(screen.getByRole('checkbox', { name: /Compact/ }));
    expect(size).toHaveAttribute('aria-valuetext', '10 pt');

    await waitFor(() => {
      expect(lastInput()).toMatchObject({
        fontSize: 10,
        margin: 14,
        lineSpacing: 1.15,
        compact: true,
      });
    }, SAVE_WAIT);

    await user.click(screen.getByRole('button', { name: 'Back to the template’s own' }));
    await waitFor(() => {
      expect(lastInput()).toMatchObject({
        fontSize: null,
        margin: null,
        lineSpacing: 1,
        compact: false,
      });
    }, SAVE_WAIT);
  });

  it('sets skills lines, section titles, dates and bullets', async () => {
    const { user } = await renderLook();
    expect(screen.getByRole('radio', { name: 'Index' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Lines' }));
    await user.click(screen.getByRole('radio', { name: 'Normal' }));
    await user.click(screen.getByRole('radio', { name: 'Bar' }));
    await user.click(screen.getByRole('radio', { name: 'Right' }));
    await user.click(screen.getByRole('radio', { name: 'Dash' }));
    await waitFor(() => {
      expect(lastInput()).toMatchObject({
        skillsStyle: 'lines',
        skillsBold: false,
        headingStyle: 'bar',
        datesSide: 'right',
        bulletStyle: 'dash',
      });
    }, SAVE_WAIT);
    expect(screen.getByRole('radio', { name: 'Lines' })).toBeChecked();
  });

  it('starts the sliders from the template you pick', async () => {
    const { user } = await renderLook();
    await user.click(screen.getByRole('radio', { name: /Compact/ }));
    expect(screen.getByRole('slider', { name: 'Text size' })).toHaveValue('10');
    expect(screen.getByRole('slider', { name: 'Margins' })).toHaveAttribute(
      'aria-valuetext',
      '15 mm (template)',
    );
  });

  it('shows the templates as small chips, without sample links or descriptions', async () => {
    await renderLook();
    expect(screen.getByRole('radio', { name: 'Compact' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Preview PDF/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Small.')).not.toBeInTheDocument();
  });

  it('says how to start the renderer when it is not running', async () => {
    await renderLook();
    expect(screen.getByText(/isn’t running/)).toHaveTextContent('pnpm pdf:up');
    // Without a photo, it can't be switched on.
    expect(screen.getByRole('checkbox', { name: 'Show my photo on the resume' })).toBeDisabled();
  });

  it('offers your own Word resume as a template, and says what it found', async () => {
    wordTemplate.current = {
      language: 'en',
      fileName: 'Ada-CV.docx',
      usable: true,
      sections: ['PROFILE', 'EXPERIENCE'],
      warnings: ['Tables and text boxes below your header become normal paragraphs.'],
    };
    const { user } = await renderLook();
    await user.click(await screen.findByRole('radio', { name: /My own Word file/ }));
    expect(screen.getByText(/Ada-CV.docx/)).toBeInTheDocument();
    expect(screen.getByText(/Tables and text boxes/)).toBeInTheDocument();
    expect(screen.getByText(/keeps its own size and spacing/)).toBeInTheDocument();
    expect(screen.getByText(/keeps its own colours/)).toBeInTheDocument();
  });

  it('says how to use your own Word file when there is none', async () => {
    await renderLook();
    expect(screen.getByText(/My profile > Resume/)).toBeInTheDocument();
  });

  it('makes My design from Claude’s reply and makes it your default template', async () => {
    const { user, onSaved } = await renderLook();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await user.click(screen.getByText('Make my own design'));

    await user.click(screen.getByRole('button', { name: 'Copy design prompt and open Claude ↗' }));
    expect(await navigator.clipboard.readText()).toBe(
      'I attached my resume. Describe its design as JSON.',
    );
    expect(open).toHaveBeenCalledWith('https://claude.ai/new', '_blank', 'noopener');

    await user.click(screen.getByRole('textbox', { name: 'Claude’s reply' }));
    await user.paste(JSON.stringify(SAVED_DESIGN));
    await user.click(screen.getByRole('button', { name: 'Save my design' }));

    expect(requests).toContainEqual({
      operation: 'SaveMyDesign',
      variables: { reply: JSON.stringify(SAVED_DESIGN) },
    });
    expect(await screen.findByRole('radio', { name: /My design/ })).toBeChecked();
    expect(onSaved).toHaveBeenCalled();
    const took = screen.getByRole('list', { name: 'What My design took from your resume' });
    expect(took).toHaveTextContent('Serif type');
    expect(took).toHaveTextContent('Centred header');
    expect(within(took).getByText('Dates on the right')).toBeInTheDocument();
    expect(screen.getByText(/Your resume has two columns/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(requests).toContainEqual({ operation: 'DeleteMyDesign', variables: {} });
    expect(await screen.findByRole('button', { name: 'Save my design' })).toBeInTheDocument();
  });
});
