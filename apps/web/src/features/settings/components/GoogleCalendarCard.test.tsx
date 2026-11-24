import { CALENDAR_CONNECT_URL } from '@jobsearch/data';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { gmail, requests } from '../../profile/test/server';
import { SettingsPage } from '../SettingsPage';

async function openCalendar() {
  const user = userEvent.setup();
  renderWithData(<SettingsPage />);
  await user.click(screen.getByRole('tab', { name: 'Gmail & Calendar' }));
  return { user, section: await screen.findByRole('region', { name: 'Google Calendar' }) };
}

describe('Google Calendar in Settings', () => {
  it('offers to connect, through the API', async () => {
    const { section } = await openCalendar();
    const link = await within(section).findByRole('link', { name: 'Connect Google Calendar' });
    expect(link).toHaveAttribute('href', CALENDAR_CONNECT_URL);
    expect(CALENDAR_CONNECT_URL).toMatch(/\/gmail\/calendar\/connect$/);
  });

  it('shows the connected account and disconnects it', async () => {
    gmail.calendar = 'me@gmail.com';
    const { user, section } = await openCalendar();
    expect(await within(section).findByText(/Connected: me@gmail.com/)).toBeVisible();
    await user.click(within(section).getByRole('button', { name: 'Disconnect' }));
    expect(
      await within(section).findByRole('link', { name: 'Connect Google Calendar' }),
    ).toBeVisible();
    expect(requests.map((r) => r.operation)).toContain('DisconnectGoogleCalendar');
  });

  it('says it is not available when the server has no Google set up', async () => {
    gmail.configured = false;
    const { section } = await openCalendar();
    expect(
      await within(section).findByText('Google Calendar is not available on this server yet.'),
    ).toBeVisible();
  });
});
