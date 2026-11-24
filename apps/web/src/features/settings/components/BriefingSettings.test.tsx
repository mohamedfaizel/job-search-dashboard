import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { requests } from '../../profile/test/server';
import { NotificationSettings } from './NotificationSettings';

describe('Settings > Notifications > Morning briefing', () => {
  it('changes the briefing time and saves it', async () => {
    const user = userEvent.setup();
    renderWithData(<NotificationSettings />);
    const box = within(await screen.findByRole('group', { name: 'Morning briefing' }));
    expect(box.getByLabelText(/Send me one summary every morning/)).toBeChecked();
    const at = box.getByLabelText('At');
    expect(at).toHaveValue('07:30');
    expect(box.queryByRole('button', { name: 'Save briefing' })).not.toBeInTheDocument();

    await user.clear(at);
    await user.type(at, '08:15');
    await user.click(box.getByRole('button', { name: 'Save briefing' }));

    expect(requests).toContainEqual({
      operation: 'SetBriefing',
      variables: { input: { on: true, at: '08:15' } },
    });
    expect(await box.findByText('Saved.')).toBeVisible();
  });
});
