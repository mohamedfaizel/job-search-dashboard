import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { requests } from '../../profile/test/server';
import { NotificationSettings } from './NotificationSettings';

describe('Settings > Notifications > Weekly report', () => {
  it('is on by default and saves as soon as you untick it', async () => {
    const user = userEvent.setup();
    renderWithData(<NotificationSettings />);
    const box = within(await screen.findByRole('group', { name: 'Weekly report' }));
    const on = box.getByLabelText(/Send me a summary every Sunday evening/);
    expect(on).toBeChecked();

    await user.click(on);

    expect(on).not.toBeChecked();
    expect(await box.findByText('Saved.')).toBeVisible();
    expect(requests).toContainEqual({ operation: 'SetWeeklyReport', variables: { on: false } });
  });
});
