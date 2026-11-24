import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { requests } from '../../profile/test/server';
import { SettingsPage } from '../SettingsPage';

describe('Settings > Nightly apply kits', () => {
  async function card() {
    renderWithData(<SettingsPage />);
    const heading = await screen.findByRole('heading', { name: 'Nightly apply kits' });
    return within(heading.closest('section') as HTMLElement);
  }

  it('turns nightly kits on with a limit per night', async () => {
    const user = userEvent.setup();
    const kits = await card();
    const perNight = await kits.findByLabelText('At most per night');
    expect(perNight).toBeDisabled();
    expect(kits.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await user.click(kits.getByLabelText(/Write my apply kits at night/));
    await user.selectOptions(perNight, '3');
    await user.click(kits.getByRole('button', { name: 'Save' }));

    expect(requests).toContainEqual({
      operation: 'SetNightlyKits',
      variables: { input: { on: true, perNight: 3 } },
    });
  });

  it('writes the kits now and says the bell will tell', async () => {
    const user = userEvent.setup();
    const kits = await card();
    await user.click(await kits.findByRole('button', { name: 'Write now' }));
    expect(await kits.findByText(/Writing 3 kits now\. The 🔔 tells you/)).toBeVisible();
    expect(requests).toContainEqual({ operation: 'WriteKitsNow', variables: {} });
  });
});
