import { API_URL, GMAIL_CONNECT_URL } from '@jobsearch/data';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { gmail, requests } from '../../profile/test/server';
import { SettingsPage } from '../SettingsPage';

const ACCOUNT = {
  id: 1,
  email: 'me@gmail.com',
  connectedAt: '2026-11-01T08:00:00.000Z',
  lastSyncAt: null,
  lastError: null,
};

async function openGmailTab() {
  const user = userEvent.setup();
  renderWithData(<SettingsPage />);
  await user.click(screen.getByRole('tab', { name: 'Gmail' }));
  return { user, section: await screen.findByRole('region', { name: 'Email' }) };
}

describe('Gmail accounts in Settings', () => {
  it('offers to connect the first account, through the API', async () => {
    const { section } = await openGmailTab();
    expect(await within(section).findByText('No Gmail account connected yet.')).toBeVisible();
    const link = within(section).getByRole('link', { name: 'Connect Gmail' });
    expect(link).toHaveAttribute('href', GMAIL_CONNECT_URL);
    expect(GMAIL_CONNECT_URL).toBe(`${API_URL.replace(/\/graphql\/?$/, '')}/gmail/connect`);
  });

  it('lists several accounts and offers another one, without a Check now (that is on the Tracker)', async () => {
    gmail.accounts = [ACCOUNT, { ...ACCOUNT, id: 2, email: 'work@gmail.com' }];
    const { section } = await openGmailTab();
    expect(await within(section).findByText('me@gmail.com')).toBeVisible();
    expect(within(section).getByText('work@gmail.com')).toBeVisible();
    expect(within(section).getAllByText('Not checked yet')).toHaveLength(2);
    expect(
      within(section).getByRole('link', { name: 'Connect another Gmail account' }),
    ).toBeVisible();
    expect(within(section).queryByRole('button', { name: /Check/ })).not.toBeInTheDocument();
  });

  it('says so when the server has no Google client', async () => {
    gmail.configured = false;
    const { section } = await openGmailTab();
    expect(
      await within(section).findByText(/Gmail is not set up on this server yet/),
    ).toBeVisible();
    expect(within(section).queryByRole('link', { name: 'Connect Gmail' })).not.toBeInTheDocument();
  });

  it('shows the reason when an account could not be read', async () => {
    gmail.accounts = [{ ...ACCOUNT, lastError: 'Access was revoked. Connect this account again.' }];
    const { section } = await openGmailTab();
    expect(await within(section).findByRole('alert')).toHaveTextContent('Access was revoked');
  });

  it('disconnects an account', async () => {
    gmail.accounts = [{ ...ACCOUNT }];
    const { user, section } = await openGmailTab();
    await user.click(
      await within(section).findByRole('button', { name: 'Disconnect me@gmail.com' }),
    );
    expect(requests).toContainEqual({ operation: 'DisconnectGmail', variables: { id: 1 } });
    expect(await within(section).findByText('No Gmail account connected yet.')).toBeVisible();
  });

  it("opens the Gmail tab with the result after Google's sign-in", async () => {
    window.history.replaceState(null, '', '/settings?gmail=connected');
    renderWithData(<SettingsPage />);
    expect(await screen.findByRole('tab', { name: 'Gmail', selected: true })).toBeVisible();
    expect(await screen.findByRole('status')).toHaveTextContent('Gmail account connected.');
  });

  it('explains a refusal', async () => {
    window.history.replaceState(null, '', '/settings?gmail=denied');
    renderWithData(<SettingsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('You did not allow access');
  });

  it('shows the section in German', async () => {
    const user = userEvent.setup();
    renderWithData(<SettingsPage />, 'de');
    await user.click(screen.getByRole('tab', { name: 'Gmail' }));
    const section = await screen.findByRole('region', { name: 'E-Mail' });
    expect(await within(section).findByText('Noch kein Gmail-Konto verbunden.')).toBeVisible();
  });
});
