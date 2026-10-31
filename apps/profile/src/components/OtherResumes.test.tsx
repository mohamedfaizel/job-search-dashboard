import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { renderWithData } from '../test/render';
import { requests } from '../test/server';

async function renderPage() {
  const user = userEvent.setup();
  renderWithData(<App />);
  await screen.findByRole('textbox', { name: 'Headline' });
  return user;
}

const section = () => screen.getByRole('region', { name: 'Resume in other languages' });

describe('resume in other languages', () => {
  it('copies a translation prompt for German and opens Claude', async () => {
    const user = await renderPage();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const write = vi.spyOn(navigator.clipboard, 'writeText');

    // German is offered first: the master resume is in English.
    expect(within(section()).getByRole('combobox', { name: 'Add your resume in' })).toHaveValue(
      'de',
    );
    await user.click(
      within(section()).getByRole('button', { name: 'Copy translation prompt and open Claude ↗' }),
    );

    expect(await within(section()).findByRole('status')).toHaveTextContent('Copied.');
    expect(requests).toContainEqual({
      operation: 'TranslationPrompt',
      variables: { language: 'de' },
    });
    expect(write).toHaveBeenCalledWith('Please translate my resume into de');
    expect(open).toHaveBeenCalledWith('https://claude.ai/new', '_blank', 'noopener');
  });

  it('saves a pasted German resume, then edits and deletes it', async () => {
    const user = await renderPage();

    await user.type(
      within(section()).getByRole('textbox', { name: 'Paste your German resume' }),
      'Ada Lovelace, Entwicklerin',
    );
    await user.click(within(section()).getByRole('button', { name: 'Save German resume' }));

    expect(requests).toContainEqual({
      operation: 'SaveLanguageResume',
      variables: { language: 'de', text: 'Ada Lovelace, Entwicklerin' },
    });
    const saved = await within(section()).findByRole('textbox', { name: 'German resume text' });
    expect(saved).toHaveValue('Ada Lovelace, Entwicklerin');
    // German is taken now, so the next language offered is another one.
    expect(within(section()).getByRole('combobox', { name: 'Add your resume in' })).not.toHaveValue(
      'de',
    );

    await user.click(within(section()).getByRole('button', { name: 'Delete' }));
    expect(requests).toContainEqual({
      operation: 'DeleteLanguageResume',
      variables: { language: 'de' },
    });
    expect(
      await within(section()).findByRole('textbox', { name: 'Paste your German resume' }),
    ).toBeInTheDocument();
  });

  it('lets you say which language the master resume is in', async () => {
    const user = await renderPage();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Language of this resume' }),
      'German',
    );
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(requests[0]).toMatchObject({
      operation: 'UpdateProfile',
      variables: { input: { resumeLanguage: 'de' } },
    });
  });
});
