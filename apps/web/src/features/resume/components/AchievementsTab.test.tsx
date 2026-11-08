import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { requests } from '../../profile/test/server';
import { AchievementsTab } from './AchievementsTab';

describe('Achievements tab', () => {
  it('saves the achievements bank on its own', async () => {
    const user = userEvent.setup();
    renderWithData(<AchievementsTab />);
    await user.type(
      await screen.findByRole('textbox', { name: 'Achievements bank' }),
      'Cut page load time by 40% at Acme (2023)',
    );
    await user.click(screen.getByRole('button', { name: 'Save achievements' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Achievements saved.');
    expect(requests[0]).toMatchObject({
      variables: { input: { achievements: 'Cut page load time by 40% at Acme (2023)' } },
    });
  });
});
