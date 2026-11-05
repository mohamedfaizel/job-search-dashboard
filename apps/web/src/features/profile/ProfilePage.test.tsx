import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { ProfilePage } from './ProfilePage';
import { renderWithData } from './test/render';
import { api, PROFILE, rejectUpload, requests, server, syncs } from './test/server';

async function renderProfile() {
  // applyAccept: false lets tests pick a file the input's `accept` would hide, like a user
  // choosing "All files" in the picker.
  const user = userEvent.setup({ applyAccept: false });
  renderWithData(<ProfilePage />);
  await screen.findByRole('textbox', { name: 'Headline' });
  return user;
}

const openTab = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole('tab', { name }));

const pdf = (name = 'cv.pdf', bytes = 10) =>
  new File(['x'.repeat(bytes)], name, { type: 'application/pdf' });

describe('profile page', () => {
  it('fills the form from the saved profile', async () => {
    const user = await renderProfile();
    await screen.findByDisplayValue('Ada King');

    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Frontend engineer');
    expect(screen.getByRole('textbox', { name: 'Roles you want' })).toHaveValue(
      'Frontend Engineer, React Developer',
    );
    expect(screen.getByRole('textbox', { name: 'Years of experience' })).toHaveValue('4');
    expect(screen.getByRole('textbox', { name: 'GitHub' })).toHaveValue('');
    // No name saved yet: it is suggested from your account name.
    expect(screen.getByRole('textbox', { name: 'First name' })).toHaveValue('Ada King');
    expect(screen.getByRole('textbox', { name: 'Last name' })).toHaveValue('Lovelace');
    // The resume is on its own tab.
    expect(screen.queryByRole('textbox', { name: 'Resume text' })).not.toBeInTheDocument();
    await openTab(user, 'Resume');
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
    const keywords = screen.getByRole('textbox', { name: 'Keywords' });
    expect(keywords).toHaveValue('accessibility');
    await user.type(keywords, ', wcag');
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
          keywords: ['accessibility', 'wcag'],
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
    await openTab(user, 'Applications');
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

  it('saves the achievements bank on the Resume tab', async () => {
    const user = await renderProfile();
    await openTab(user, 'Resume');
    await user.type(
      screen.getByRole('textbox', { name: 'Achievements bank' }),
      'Cut page load time by 40% at Acme (2023)',
    );

    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
    expect(requests[0]).toMatchObject({
      variables: { input: { achievements: 'Cut page load time by 40% at Acme (2023)' } },
    });
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
    const user = await renderProfile();
    await openTab(user, 'Resume');

    const box = screen.getByRole('region', { name: 'Suggestions for your resume' });
    expect(
      within(box).getByText(/differs from My profile \(German: B2 → A2\)/),
    ).toBeInTheDocument();
    expect(within(box).getByText(/Only 12 of 35 bullets have a number/)).toBeInTheDocument();
    expect(
      within(box).getByText(/About 3 pages \(1238 words\), more than your limit of 2/),
    ).toBeInTheDocument();
    expect(within(box).getByText(/Your resume has 2 achievements/)).toBeInTheDocument();
    await user.click(within(box).getByRole('button', { name: 'Copy to Achievements bank' }));
    expect(screen.getByRole('textbox', { name: 'Achievements bank' })).toHaveValue(
      'Cut costs by 20%\nLed 5 people',
    );
    await user.click(within(box).getByRole('button', { name: 'Ask Claude for more suggestions' }));
    expect(within(box).getByRole('textbox', { name: 'Review prompt' })).toHaveValue(
      'Please review my resume as an experienced tech recruiter.',
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Page limit' }), '3');
    await user.click(screen.getByRole('checkbox', { name: /Keep all my headings/ }));
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
    expect(requests[0]).toMatchObject({
      variables: {
        input: {
          achievements: 'Cut costs by 20%\nLed 5 people',
          resumeMaxPages: 3,
          keepMySections: true,
        },
      },
    });
    expect(requests[0]?.variables).not.toHaveProperty('input.resumeSuggestions');
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

  it('shows the page and its error messages in German', async () => {
    const user = userEvent.setup();
    renderWithData(<ProfilePage />, 'de');
    const headline = await screen.findByRole('textbox', { name: 'Kurzprofil' });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mein Profil');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Persönlich',
      'Bewerbungsangaben',
      'Lebenslauf',
      'Design',
      'E-Mail',
      'Resume-Matcher',
    ]);
    expect(headline).toHaveValue('Frontend engineer');
    const years = screen.getByRole('textbox', { name: 'Jahre Berufserfahrung' });
    await user.clear(years);
    await user.type(years, '99');
    await user.click(screen.getByRole('button', { name: 'Profil speichern' }));

    expect(
      await screen.findByText('Die Berufserfahrung muss zwischen 0 und 60 Jahren liegen'),
    ).toBeInTheDocument();
    // Language names come from the browser, in German.
    await user.click(screen.getByRole('tab', { name: 'Lebenslauf' }));
    expect(screen.getByRole('combobox', { name: 'Sprache dieses Lebenslaufs' })).toHaveDisplayValue(
      'Englisch',
    );
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
    await openTab(user, 'Resume');

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
    await openTab(user, 'Resume');
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

  it('saves your personal details and your own fields', async () => {
    const user = await renderProfile();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Gender' }), 'female');
    await user.type(screen.getByLabelText('Date of birth'), '1990-12-10');
    await user.type(screen.getByRole('textbox', { name: 'Nationality' }), 'British');

    await openTab(user, 'Applications');
    await user.type(screen.getByRole('textbox', { name: 'Driving licence' }), 'Class B');
    await user.click(screen.getByRole('button', { name: '+ Add a field' }));
    await user.type(screen.getByRole('textbox', { name: 'Field 1 name' }), 'Xing');
    await user.type(screen.getByRole('textbox', { name: 'Field 1 value' }), 'https://xing.com/ada');
    // An empty row is fine: it is left out when saving.
    await user.click(screen.getByRole('button', { name: '+ Add a field' }));

    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
    expect(requests[0]).toMatchObject({
      variables: {
        input: {
          firstName: 'Ada King',
          lastName: 'Lovelace',
          gender: 'female',
          dateOfBirth: '1990-12-10',
          nationality: 'British',
          drivingLicence: 'Class B',
          customFields: [{ label: 'Xing', value: 'https://xing.com/ada' }],
        },
      },
    });

    await user.click(screen.getByRole('button', { name: 'Remove field 1' }));
    expect(screen.queryByRole('textbox', { name: 'Field 2 name' })).not.toBeInTheDocument();
  });

  it('opens the tab with the mistake when you save', async () => {
    const user = await renderProfile();
    await openTab(user, 'Applications');
    await user.click(screen.getByRole('button', { name: '+ Add a field' }));
    // The new row is the last one (the shared cache may hold fields saved by another test).
    const values = screen.getAllByRole('textbox', { name: /^Field \d+ value$/ });
    await user.type(values[values.length - 1]!, 'no name');
    await openTab(user, 'Personal');

    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText(/Give the field a name/)).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Applications' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(requests).toHaveLength(0);
  });

  it('moves between tabs with the arrow keys and remembers the last one', async () => {
    const user = await renderProfile();
    screen.getByRole('tab', { name: 'Personal' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Applications' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Resume-Matcher' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(localStorage.getItem('jobsearch.profile.tab')).toBe('matcher');
  });
});
