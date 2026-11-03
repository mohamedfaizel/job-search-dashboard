import { API_URL, GMAIL_CONNECT_URL } from '@jobsearch/data';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { ProfilePage } from '../ProfilePage';
import { renderWithData } from '../test/render';
import { api, gmail, requests, server } from '../test/server';

const ACCOUNT = {
  id: 1,
  email: 'me@gmail.com',
  connectedAt: '2026-11-01T08:00:00.000Z',
  lastSyncAt: null,
  lastError: null,
};

async function openMailTab() {
  const user = userEvent.setup();
  renderWithData(<ProfilePage />);
  await screen.findByRole('textbox', { name: 'Headline' });
  await user.click(screen.getByRole('tab', { name: 'Email' }));
  return { user, section: await screen.findByRole('region', { name: 'Email' }) };
}

describe('Gmail accounts on My profile', () => {
  it('offers to connect the first account, through the API', async () => {
    const { section } = await openMailTab();
    expect(await within(section).findByText('No Gmail account connected yet.')).toBeVisible();
    const link = within(section).getByRole('link', { name: 'Connect Gmail' });
    expect(link).toHaveAttribute('href', GMAIL_CONNECT_URL);
    expect(GMAIL_CONNECT_URL).toBe(`${API_URL.replace(/\/graphql\/?$/, '')}/gmail/connect`);
    expect(within(section).queryByRole('button', { name: 'Check now' })).not.toBeInTheDocument();
  });

  it('lists several accounts and offers another one', async () => {
    gmail.accounts = [ACCOUNT, { ...ACCOUNT, id: 2, email: 'work@gmail.com' }];
    const { section } = await openMailTab();
    expect(await within(section).findByText('me@gmail.com')).toBeVisible();
    expect(within(section).getByText('work@gmail.com')).toBeVisible();
    expect(within(section).getAllByText('Not checked yet')).toHaveLength(2);
    expect(
      within(section).getByRole('link', { name: 'Connect another Gmail account' }),
    ).toBeVisible();
  });

  it('says so when the server has no Google client', async () => {
    gmail.configured = false;
    const { section } = await openMailTab();
    expect(
      await within(section).findByText(/Gmail is not set up on this server yet/),
    ).toBeVisible();
    expect(within(section).queryByRole('link', { name: 'Connect Gmail' })).not.toBeInTheDocument();
  });

  it('checks the mail now and says how many suggestions it found', async () => {
    gmail.accounts = [{ ...ACCOUNT }];
    gmail.found = 2;
    const { user, section } = await openMailTab();
    await user.click(await within(section).findByRole('button', { name: 'Check now' }));
    expect(await within(section).findByRole('status')).toHaveTextContent(
      '2 new suggestions. See them on your tracker.',
    );
    expect(await within(section).findByText(/Last checked/)).toBeVisible();
  });

  it('shows the reason when an account could not be read', async () => {
    gmail.accounts = [{ ...ACCOUNT, lastError: 'Access was revoked. Connect this account again.' }];
    const { section } = await openMailTab();
    expect(await within(section).findByRole('alert')).toHaveTextContent('Access was revoked');
  });

  it('disconnects an account', async () => {
    gmail.accounts = [{ ...ACCOUNT }];
    const { user, section } = await openMailTab();
    await user.click(
      await within(section).findByRole('button', { name: 'Disconnect me@gmail.com' }),
    );
    expect(requests).toContainEqual({ operation: 'DisconnectGmail', variables: { id: 1 } });
    expect(await within(section).findByText('No Gmail account connected yet.')).toBeVisible();
  });

  it('reports a failed check and a failed load', async () => {
    gmail.accounts = [{ ...ACCOUNT }];
    server.use(api.mutation('SyncGmail', () => HttpResponse.json({ errors: [{ message: 'x' }] })));
    const { user, section } = await openMailTab();
    await user.click(await within(section).findByRole('button', { name: 'Check now' }));
    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'Could not check your email',
    );
  });

  it('opens on the Email tab with the result when Google sends you back', async () => {
    window.history.replaceState(null, '', '/profile?gmail=connected');
    renderWithData(<ProfilePage />);
    expect(await screen.findByRole('status')).toHaveTextContent('Gmail account connected.');
    expect(screen.getByRole('tab', { name: 'Email', selected: true })).toBeVisible();
    expect(window.location.search).toBe('');
  });

  it('explains a refusal', async () => {
    window.history.replaceState(null, '', '/profile?gmail=denied');
    renderWithData(<ProfilePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('You did not allow access');
  });

  it('shows the section in German', async () => {
    const user = userEvent.setup();
    renderWithData(<ProfilePage />, 'de');
    await user.click(await screen.findByRole('tab', { name: 'E-Mail' }));
    const section = await screen.findByRole('region', { name: 'E-Mail' });
    expect(await within(section).findByText('Noch kein Gmail-Konto verbunden.')).toBeVisible();
  });
});
