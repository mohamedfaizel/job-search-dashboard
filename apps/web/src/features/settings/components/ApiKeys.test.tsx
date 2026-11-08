import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { apiKeys, PROFILE, requests } from '../../profile/test/server';
import { SettingsPage } from '../SettingsPage';

describe('Settings > API keys', () => {
  it('saves a JobHunter token, then shows only its last 4 characters', async () => {
    const user = userEvent.setup();
    renderWithData(<SettingsPage />);
    const section = await screen.findByRole('region', { name: 'API keys' });
    expect(await within(section).findByText('Not set')).toBeVisible();

    await user.type(within(section).getByLabelText('JobHunter token'), 'jp_secret_a9F2');
    await user.click(within(section).getByRole('button', { name: 'Save' }));

    expect(requests).toContainEqual({
      operation: 'SaveApiKey',
      variables: { input: { kind: 'JOBHUNTER', value: 'jp_secret_a9F2' } },
    });
    expect(await within(section).findByLabelText('Saved key ending in a9F2')).toHaveTextContent(
      /•+a9F2/,
    );
    expect(within(section).queryByText(/jp_secret/)).not.toBeInTheDocument();
  });

  it('tests a saved token and shows the credits left', async () => {
    apiKeys.push({
      kind: 'JOBHUNTER',
      last4: 'a9F2',
      model: null,
      credits: null,
      updatedAt: '2026-11-08T12:00:00.000Z',
    });
    const user = userEvent.setup();
    renderWithData(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Test' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Works · 412 credits left');
  });

  it('deletes a token only after you confirm', async () => {
    apiKeys.push({
      kind: 'JOBHUNTER',
      last4: 'a9F2',
      model: null,
      credits: 3,
      updatedAt: '2026-11-08T12:00:00.000Z',
    });
    const user = userEvent.setup();
    renderWithData(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete your JobHunter token' }));
    const confirm = screen.getByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Delete key' }));

    expect(requests).toContainEqual({
      operation: 'DeleteApiKey',
      variables: { kind: 'JOBHUNTER' },
    });
    expect(await screen.findByText('Not set')).toBeVisible();
  });

  it('shows in German', async () => {
    renderWithData(<SettingsPage />, 'de');
    expect(await screen.findByRole('heading', { name: 'API-Schlüssel' })).toBeVisible();
    expect(await screen.findByText('Nicht gesetzt')).toBeVisible();
  });
});

describe('Settings > Notifications', () => {
  it('saves the two notification settings on their own', async () => {
    const user = userEvent.setup();
    renderWithData(<SettingsPage />);
    await user.click(screen.getByRole('tab', { name: 'Notifications' }));

    const box = await screen.findByRole('checkbox', {
      name: /Tell me when a scheduled search finds new jobs/,
    });
    expect(box).toBeChecked();
    await user.selectOptions(screen.getByLabelText('A job fits me from'), '70');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved.')).toBeVisible();
    expect(requests).toContainEqual({
      operation: 'UpdateNotificationSettings',
      variables: { input: { notifyNewMatches: PROFILE.notifyNewMatches, matchFitMin: 70 } },
    });
  });
});
