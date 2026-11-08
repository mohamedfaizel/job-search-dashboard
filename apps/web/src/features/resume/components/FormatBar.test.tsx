import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { server } from '../../profile/test/server';
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

describe('Format bar', () => {
  it('is off until you click in a field, then bolds the selected text', async () => {
    const user = await renderBuilder();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled();
    const field = screen.getByDisplayValue<HTMLTextAreaElement>('Engineer who ships.');
    await user.click(field);
    expect(screen.getByRole('button', { name: 'Bold' })).toBeEnabled();
    field.setSelectionRange(0, 8);
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expect(field).toHaveValue('**Engineer** who ships.');
    await waitFor(() => {
      expect(lastSaved()?.sections[0]?.blocks[0]).toMatchObject({
        text: '**Engineer** who ships.',
      });
    }, SAVE_WAIT);
    await user.click(screen.getByRole('button', { name: 'Clear formatting' }));
    expect(field).toHaveValue('Engineer who ships.');
  });

  it('works with Ctrl+B and Ctrl+I', async () => {
    const user = await renderBuilder();
    const field = screen.getByDisplayValue<HTMLTextAreaElement>('Engineer who ships.');
    await user.click(field);
    field.setSelectionRange(9, 12);
    await user.keyboard('{Control>}i{/Control}');
    expect(field).toHaveValue('Engineer *who* ships.');
    field.setSelectionRange(0, 8);
    await user.keyboard('{Control>}b{/Control}');
    expect(field).toHaveValue('**Engineer** *who* ships.');
  });

  it('adds a link from the address you type', async () => {
    const user = await renderBuilder();
    const field = screen.getByDisplayValue<HTMLTextAreaElement>('Engineer who ships.');
    await user.click(field);
    field.setSelectionRange(0, 8);
    await user.click(screen.getByRole('button', { name: 'Link' }));
    await user.type(screen.getByRole('textbox', { name: 'Link address' }), 'example.com');
    await user.click(screen.getByRole('button', { name: 'Add the link' }));
    expect(field).toHaveValue('[Engineer](https://example.com) who ships.');
  });
});

describe('Skills row', () => {
  it('shows a skills paragraph as a label and a list, saved as "Label: list"', async () => {
    const user = await renderBuilder();
    const title = screen.getAllByRole('textbox', { name: 'Section title' })[0] as HTMLElement;
    await user.clear(title);
    await user.type(title, 'Skills');
    const label = screen.getByRole('textbox', { name: 'Skills label' });
    expect(screen.getByRole('textbox', { name: 'Skills list' })).toHaveValue('Engineer who ships.');
    await user.type(label, 'Frontend');
    await waitFor(() => {
      expect(lastSaved()?.sections[0]?.blocks[0]).toMatchObject({
        text: 'Frontend: Engineer who ships.',
      });
    }, SAVE_WAIT);
    // The list can hold a colon without moving the label.
    await user.type(screen.getByRole('textbox', { name: 'Skills list' }), ' a: b');
    expect(label).toHaveValue('Frontend');
    await user.click(screen.getByRole('button', { name: '+ Skills row' }));
    expect(screen.getAllByRole('textbox', { name: 'Skills label' })).toHaveLength(2);
  });
});
