import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { ProfilePage } from './ProfilePage';
import { renderWithData } from './test/render';
import { api, requests, savedAnswers, server } from './test/server';

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

describe('profile page', () => {
  it('lists your saved answers for Claude, with the two settings, to edit or delete', async () => {
    savedAnswers.push(
      {
        id: 1,
        question: 'Salary per year?',
        answer: '65.000 € gross',
        updatedAt: '2026-11-05T12:00:00.000Z',
      },
      {
        id: 2,
        question: 'Real experience with WCAG?',
        answer: 'Yes: audits',
        updatedAt: '2026-11-04T12:00:00.000Z',
      },
    );
    const user = await renderProfile();
    await openTab(user, 'Applications');

    expect(
      screen.getByRole('checkbox', { name: 'Fill in my saved answers by themselves' }),
    ).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Show Stretches/ })).toBeChecked();
    const list = await screen.findByRole('list', { name: 'Saved answers' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    await user.click(
      within(list).getByRole('button', { name: 'Edit your answer to: Salary per year?' }),
    );
    const box = within(list).getByRole('textbox', { name: 'Your answer to: Salary per year?' });
    await user.clear(box);
    await user.type(box, '70.000 € gross{Enter}');
    expect(requests).toContainEqual({
      operation: 'SaveAnswer',
      variables: { question: 'Salary per year?', answer: '70.000 € gross' },
    });
    expect(await within(list).findByText('70.000 € gross')).toBeInTheDocument();

    // Escape throws an edit away.
    await user.click(
      within(list).getByRole('button', { name: 'Edit your answer to: Salary per year?' }),
    );
    await user.type(within(list).getByRole('textbox'), 'x{Escape}');
    expect(within(list).queryByRole('textbox')).toBeNull();

    await user.click(
      within(list).getByRole('button', {
        name: 'Delete your answer to: Real experience with WCAG?',
      }),
    );
    expect(requests).toContainEqual({ operation: 'DeleteSavedAnswer', variables: { id: 2 } });
    await waitFor(() => {
      expect(
        within(screen.getByRole('list', { name: 'Saved answers' })).getAllByRole('listitem'),
      ).toHaveLength(1);
    });
  });

  it('says so when you have no saved answers yet', async () => {
    const user = await renderProfile();
    await openTab(user, 'Applications');
    expect(await screen.findByText(/No saved answers yet/)).toBeInTheDocument();
  });

  it('fills the form from the saved profile', async () => {
    await renderProfile();
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
      'Erfolge',
    ]);
    expect(headline).toHaveValue('Frontend engineer');
    const years = screen.getByRole('textbox', { name: 'Jahre Berufserfahrung' });
    await user.clear(years);
    await user.type(years, '99');
    await user.click(screen.getByRole('button', { name: 'Profil speichern' }));

    expect(
      await screen.findByText('Die Berufserfahrung muss zwischen 0 und 60 Jahren liegen'),
    ).toBeInTheDocument();
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
    expect(screen.getByRole('tab', { name: 'Achievements' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(localStorage.getItem('jobsearch.profile.tab')).toBe('achievements');
    // Achievements moved here from the Resume page.
    expect(await screen.findByRole('textbox', { name: /Achievements bank/ })).toBeInTheDocument();
    // Design and Resume moved to the Resume page: only one place has each.
    expect(screen.queryByRole('tab', { name: 'Design' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Resume' })).not.toBeInTheDocument();
  });
});
