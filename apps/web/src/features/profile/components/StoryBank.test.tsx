import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../test/render';
import { requests, stories } from '../test/server';
import { splitTags, StoryBank } from './StoryBank';

const STORY = {
  id: 7,
  title: 'Faster nightly load',
  situation: 'The load took 4 hours.',
  task: 'Make it fit the night.',
  action: 'Moved it to Airflow.',
  result: 'It runs in 40 minutes.',
  reflection: '',
  tags: ['Airflow', 'SQL'],
  updatedAt: '2026-11-09T12:00:00.000Z',
};

describe('Story bank', () => {
  it('adds a STAR story with its skills', async () => {
    const user = userEvent.setup();
    renderWithData(<StoryBank />);
    expect(await screen.findByText(/No stories yet/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add story' }));
    const form = screen.getByRole('form', { name: 'Add story' });
    await user.type(within(form).getByRole('textbox', { name: 'Title' }), 'Led the BI move');
    await user.type(
      within(form).getByRole('textbox', { name: /^Situation/ }),
      'Reports came from Excel.',
    );
    await user.type(within(form).getByRole('textbox', { name: /^Result/ }), '12 dashboards live.');
    await user.type(
      within(form).getByRole('textbox', { name: 'Skills it shows' }),
      'Power BI, leadership, power bi',
    );
    await user.click(within(form).getByRole('button', { name: 'Save story' }));

    await waitFor(() => {
      expect(screen.queryByRole('form', { name: 'Add story' })).toBeNull();
    });
    expect(requests.find((r) => r.operation === 'SaveStory')?.variables['input']).toMatchObject({
      title: 'Led the BI move',
      situation: 'Reports came from Excel.',
      result: '12 dashboards live.',
      tags: ['power bi', 'leadership'],
    });
    expect(await screen.findByText('Led the BI move')).toBeInTheDocument();
    expect(screen.getByText('leadership')).toBeInTheDocument();
  });

  it('shows an error and keeps the form when the story is refused', async () => {
    const user = userEvent.setup();
    renderWithData(<StoryBank />);
    await user.click(await screen.findByRole('button', { name: '+ Add story' }));
    const form = screen.getByRole('form', { name: 'Add story' });
    // The browser would stop an empty title; spaces get through to the API.
    await user.type(within(form).getByRole('textbox', { name: 'Title' }), '   ');
    await user.click(within(form).getByRole('button', { name: 'Save story' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      /needs a title of at most 120/,
    );
    await user.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form', { name: 'Add story' })).toBeNull();
  });

  it('opens, edits and deletes a story', async () => {
    stories.push(STORY);
    const user = userEvent.setup();
    renderWithData(<StoryBank />);
    await user.click(await screen.findByText('Faster nightly load'));
    expect(screen.getByText('Moved it to Airflow.')).toBeVisible();
    expect(screen.queryByText('Reflection')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Edit story Faster nightly load' }));
    const form = screen.getByRole('form', { name: 'Edit story Faster nightly load' });
    expect(within(form).getByRole('textbox', { name: 'Skills it shows' })).toHaveValue(
      'Airflow, SQL',
    );
    await user.type(within(form).getByRole('textbox', { name: /^Reflection/ }), 'Measure first.');
    await user.click(within(form).getByRole('button', { name: 'Save story' }));
    await waitFor(() => {
      expect(requests.at(-1)?.variables['input']).toMatchObject({
        id: 7,
        reflection: 'Measure first.',
      });
    });

    await user.click(
      await screen.findByRole('button', { name: 'Delete story Faster nightly load' }),
    );
    // Asked first; ✕ keeps it.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(requests.some((r) => r.operation === 'DeleteStory')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Delete story Faster nightly load' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete Faster nightly load' }));
    expect(await screen.findByText(/No stories yet/)).toBeInTheDocument();
  });

  it('splits tags by comma, once each', () => {
    expect(splitTags(' SQL, , sql ,Airflow')).toEqual(['sql', 'Airflow']);
  });
});
