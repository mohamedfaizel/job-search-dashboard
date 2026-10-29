import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import App from './App';
import { renderWithData } from './test/render';
import { api, rejectUpload, requests, server, syncs } from './test/server';

async function renderProfile() {
  // applyAccept: false lets tests pick a file the input's `accept` would hide, like a user
  // choosing "All files" in the picker.
  const user = userEvent.setup({ applyAccept: false });
  renderWithData(<App />);
  await screen.findByRole('textbox', { name: 'Headline' });
  return user;
}

const pdf = (name = 'cv.pdf', bytes = 10) =>
  new File(['x'.repeat(bytes)], name, { type: 'application/pdf' });

describe('profile page', () => {
  it('fills the form from the saved profile', async () => {
    await renderProfile();

    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Frontend engineer');
    expect(screen.getByRole('textbox', { name: 'Roles you want' })).toHaveValue(
      'Frontend Engineer, React Developer',
    );
    expect(screen.getByRole('textbox', { name: 'Years of experience' })).toHaveValue('4');
    expect(screen.getByRole('textbox', { name: 'GitHub' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Resume text' })).toHaveValue(
      'Ada Lovelace\nFrontend engineer',
    );
    expect(screen.getByText('Last upload: ada.pdf')).toBeInTheDocument();
  });

  it('saves the profile with lists split on commas', async () => {
    const user = await renderProfile();
    const skills = screen.getByRole('textbox', { name: 'Skills' });
    await user.clear(skills);
    await user.type(skills, 'React,  Node.js , ,GraphQL');
    const languages = screen.getByRole('textbox', { name: 'Languages' });
    await user.clear(languages);
    await user.type(languages, 'German A2, English C1');
    await user.type(screen.getByRole('textbox', { name: 'GitHub' }), 'https://github.com/ada');

    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
    expect(requests[0]).toMatchObject({
      operation: 'UpdateProfile',
      variables: {
        input: {
          skills: ['React', 'Node.js', 'GraphQL'],
          languages: ['German A2', 'English C1'],
          yearsExperience: 4,
          githubUrl: 'https://github.com/ada',
          websiteUrl: null,
        },
      },
    });
  });

  it('saves the application answers the Apply kit uses', async () => {
    const user = await renderProfile();
    expect(screen.getByRole('textbox', { name: 'Work permit' })).toHaveValue('EU Blue Card');
    await user.type(screen.getByRole('textbox', { name: 'Salary expectation' }), '€65,000 a year');
    await user.type(
      screen.getByRole('textbox', { name: 'Saved answers' }),
      'I want to build products people use.',
    );

    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
    expect(requests[0]).toMatchObject({
      variables: {
        input: {
          phone: '+49 151 0000000',
          workPermit: 'EU Blue Card',
          salaryExpectation: '€65,000 a year',
          applicationNotes: 'I want to build products people use.',
        },
      },
    });
  });

  it('shows what to fix before saving', async () => {
    const user = await renderProfile();
    await user.type(screen.getByRole('textbox', { name: 'Website' }), 'my site');
    const years = screen.getByRole('textbox', { name: 'Years of experience' });
    await user.clear(years);
    await user.type(years, '99');

    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Website must be a full link (https://…)')).toBeInTheDocument();
    expect(screen.getByText('Years of experience must be between 0 and 60')).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('shows the API error when saving fails', async () => {
    server.use(
      api.mutation('UpdateProfile', () =>
        HttpResponse.json({ errors: [{ message: 'Please log in' }] }),
      ),
    );
    const user = await renderProfile();

    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save: Please log in');
  });

  it('uploads a resume and puts its text in the box, keeping other edits', async () => {
    const user = await renderProfile();
    const headline = screen.getByRole('textbox', { name: 'Headline' });
    await user.clear(headline);
    await user.type(headline, 'Not saved yet');

    await user.upload(screen.getByLabelText('Upload a PDF or Word file'), pdf('new cv.pdf'));

    const resume = screen.getByRole('region', { name: 'Master resume' });
    expect(await within(resume).findByRole('status')).toHaveTextContent('Resume read.');
    expect(screen.getByRole('textbox', { name: 'Resume text' })).toHaveValue('Text from the PDF');
    expect(screen.getByText('Last upload: new cv.pdf')).toBeInTheDocument();
    expect(headline).toHaveValue('Not saved yet');
    expect(requests).toEqual([{ operation: 'UploadResume', variables: { sent: true } }]);
    // Resume-Matcher is running, so the new file is sent to it straight away.
    await waitFor(() => {
      expect(syncs).toHaveLength(1);
    });
  });

  it('explains when a file can’t be used', async () => {
    server.use(rejectUpload);
    const user = await renderProfile();
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
});
