import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { renderWithData } from '../test/render';
import { requests } from '../test/server';

async function renderPage() {
  const user = userEvent.setup();
  renderWithData(<App />);
  await screen.findByRole('radio', { name: /Modern/ });
  return user;
}

const section = () => screen.getByRole('region', { name: 'Resume and cover letter design' });

describe('resume and cover letter design', () => {
  it('saves the template, colour, type and letter layout you pick', async () => {
    const user = await renderPage();
    const design = section();
    expect(within(design).getByRole('radio', { name: /Classic/ })).toBeChecked();

    await user.click(within(design).getByRole('radio', { name: /Modern/ }));
    await user.click(within(design).getByRole('radio', { name: 'Teal' }));
    await user.selectOptions(within(design).getByRole('combobox', { name: 'Type' }), 'serif');
    await user.selectOptions(
      within(design).getByRole('combobox', { name: 'Cover letter layout' }),
      'din',
    );
    await user.click(within(design).getByRole('button', { name: 'Save design' }));

    expect(requests).toContainEqual({
      operation: 'UpdateDocumentStyle',
      variables: {
        input: {
          resumeTemplate: 'modern',
          coverLetterLayout: 'din',
          accentColor: '0E7C66',
          font: 'serif',
          showPhoto: false,
        },
      },
    });
    expect(await within(design).findByText(/Design saved/)).toBeInTheDocument();
  });

  it('links a sample PDF in your colours for each template', async () => {
    const user = await renderPage();
    await user.click(within(section()).getByRole('radio', { name: 'Teal' }));
    expect(within(section()).getByRole('link', { name: 'Preview Compact (PDF)' })).toHaveAttribute(
      'href',
      expect.stringContaining('/documents/preview/resume.pdf?template=compact&accent=0E7C66'),
    );
  });

  it('says how to start the renderer when it is not running', async () => {
    await renderPage();
    expect(within(section()).getByText(/isn’t running/)).toHaveTextContent('pnpm pdf:up');
    // Without a photo, it can't be switched on.
    expect(
      within(section()).getByRole('checkbox', { name: 'Show my photo on the resume' }),
    ).toBeDisabled();
  });
});
