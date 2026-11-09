import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { renderWithData } from '../../profile/test/render';
import { api, PROFILE, rejectUpload, requests, server, syncs } from '../../profile/test/server';
import { ResumeFiles } from './ResumeFiles';

async function renderFiles() {
  // applyAccept: false lets tests pick a file the input's `accept` would hide, like a user
  // choosing "All files" in the picker.
  const user = userEvent.setup({ applyAccept: false });
  renderWithData(<ResumeFiles />);
  await screen.findByRole('region', { name: 'Master resume' });
  return user;
}

const pdf = (name = 'cv.pdf', bytes = 10) =>
  new File(['x'.repeat(bytes)], name, { type: 'application/pdf' });

describe('Resume files tab', () => {
  it('shows the uploaded file and no resume text box', async () => {
    await renderFiles();
    expect(screen.queryByRole('textbox', { name: 'Resume text' })).not.toBeInTheDocument();
    expect(screen.getByText('Last upload: ada.pdf')).toBeInTheDocument();
  });

  it('suggests fixes for your resume and copies its achievements to the bank', async () => {
    server.use(
      api.query('MyProfile', () =>
        HttpResponse.json({
          data: {
            myProfile: {
              ...PROFILE,
              resumeReviewPrompt: 'Please review my resume as an experienced tech recruiter.',
              resumeSuggestions: [
                { code: 'LEVEL', detail: 'German: B2 → A2' },
                { code: 'NUMBERS', detail: '12/35' },
                { code: 'LENGTH', detail: '1238/3/2' },
                { code: 'ACHIEVEMENTS', detail: 'Cut costs by 20%\nLed 5 people' },
              ],
            },
          },
        }),
      ),
    );
    const user = await renderFiles();

    // Folded into a pill, so the Setup tab stays short.
    await user.click(screen.getByText('4 suggestions'));
    const box = screen.getByRole('region', { name: 'Suggestions for your resume' });
    expect(box).toBeVisible();
    expect(
      within(box).getByText(/differs from My profile \(German: B2 → A2\)/),
    ).toBeInTheDocument();
    expect(within(box).getByText(/Only 12 of 35 bullets have a number/)).toBeInTheDocument();
    expect(
      within(box).getByText(/About 3 pages \(1238 words\), more than your limit of 2/),
    ).toBeInTheDocument();
    expect(within(box).getByText(/Your resume has 2 achievements/)).toBeInTheDocument();
    // The bank has its own tab: the lines are saved there straight away.
    await user.click(within(box).getByRole('button', { name: 'Copy to Achievements bank' }));
    expect(await screen.findByText('Copied to your Achievements bank and saved.')).toBeVisible();
    expect(requests[0]).toMatchObject({
      operation: 'UpdateProfile',
      variables: { input: { achievements: 'Cut costs by 20%\nLed 5 people' } },
    });
    await user.click(within(box).getByRole('button', { name: 'Ask Claude for more suggestions' }));
    expect(within(box).getByRole('textbox', { name: 'Review prompt' })).toHaveValue(
      'Please review my resume as an experienced tech recruiter.',
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Page limit' }), '3');
    await user.click(screen.getByRole('checkbox', { name: /Keep all my headings/ }));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => {
      expect(requests).toHaveLength(2);
    });
    expect(requests[1]).toMatchObject({
      variables: { input: { resumeMaxPages: 3, keepMySections: true } },
    });
    expect(requests[1]?.variables).not.toHaveProperty('input.resumeSuggestions');
  });

  it('uploads a resume and saves its text, keeping other edits', async () => {
    const user = await renderFiles();

    await user.upload(screen.getByLabelText('Upload a PDF or Word file'), pdf('new cv.pdf'));

    const resume = screen.getByRole('region', { name: 'Master resume' });
    expect(await within(resume).findByRole('status')).toHaveTextContent('Resume read.');
    expect(screen.getByText('Last upload: new cv.pdf')).toBeInTheDocument();
    expect(requests).toEqual([{ operation: 'UploadResume', variables: { sent: true } }]);
    // Resume-Matcher is running, so the new file is sent to it straight away.
    await waitFor(() => {
      expect(syncs).toHaveLength(1);
    });
  });

  it('explains when a file can’t be used', async () => {
    server.use(rejectUpload);
    const user = await renderFiles();
    const input = screen.getByLabelText('Upload a PDF or Word file');

    await user.upload(input, new File(['hi'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload a PDF or Word (.docx) file');

    await user.upload(input, pdf('huge.pdf', 5 * 1024 * 1024 + 1));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('That file is over 5 MB.');
    });
    // Only the text file was sent: the big one never left the browser.
    expect(requests).toHaveLength(1);
  });

  it('names the resume languages in German', async () => {
    renderWithData(<ResumeFiles />, 'de');
    expect(
      await screen.findByRole('combobox', { name: 'Sprache dieses Lebenslaufs' }),
    ).toHaveDisplayValue('Englisch');
  });
});
