import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../../profile/test/render';
import { apiKeys, me, poolKey, PROFILE, requests } from '../../profile/test/server';
import { SettingsPage } from '../SettingsPage';

/** One key's card, found by its heading ("JobHunter token", "Claude API key"…). */
async function card(name: string) {
  const heading = await screen.findByRole('heading', { name });
  return within(heading.closest('div.rounded-md') as HTMLElement);
}

describe('Settings > API keys', () => {
  it('saves a JobHunter token, then shows only its last 4 characters', async () => {
    const user = userEvent.setup();
    renderWithData(<SettingsPage />);
    const jobHunter = await card('JobHunter token');
    expect(jobHunter.getByText('Not set')).toBeVisible();

    await user.type(jobHunter.getByLabelText('JobHunter token'), 'jp_secret_a9F2');
    await user.click(jobHunter.getByRole('button', { name: 'Save' }));

    expect(requests).toContainEqual({
      operation: 'SaveApiKey',
      variables: { input: { kind: 'JOBHUNTER', value: 'jp_secret_a9F2', model: null } },
    });
    // Once saved, the key is not shown at all, not even its last letters.
    expect(await jobHunter.findByRole('button', { name: 'Replace' })).toBeVisible();
    expect(jobHunter.getByText('✓ Saved')).toBeVisible();
    expect(jobHunter.queryByText(/a9F2/)).not.toBeInTheDocument();
    expect(jobHunter.queryByLabelText('JobHunter token')).not.toBeInTheDocument();
    expect(jobHunter.queryByText(/jp_secret/)).not.toBeInTheDocument();
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
    expect(await (await card('JobHunter token')).findByText('Not set')).toBeVisible();
  });

  it('shows in German', async () => {
    renderWithData(<SettingsPage />, 'de');
    expect(await screen.findByRole('heading', { name: 'API-Schlüssel' })).toBeVisible();
    expect((await card('JobHunter-Token')).getByText('Nicht gesetzt')).toBeVisible();
    expect((await card('Claude-API-Schlüssel')).getByText('Nicht gesetzt')).toBeVisible();
  });
});

describe('Settings > API keys > AI', () => {
  it('saves a Claude key with a model and tests it for free', async () => {
    const user = userEvent.setup();
    renderWithData(<SettingsPage />);
    const claude = await card('Claude API key');
    expect(screen.getByRole('radio', { name: 'Claude' })).toBeChecked();
    expect(screen.getByText('Copy-and-open buttons open Claude.')).toBeVisible();

    await user.type(claude.getByLabelText('Claude API key'), 'sk-ant-secret-Zx9q');
    await user.type(claude.getByLabelText('Model'), 'claude-haiku-5-5');
    await user.click(claude.getByRole('button', { name: 'Save' }));

    expect(requests).toContainEqual({
      operation: 'SaveApiKey',
      variables: {
        input: { kind: 'ANTHROPIC', value: 'sk-ant-secret-Zx9q', model: 'claude-haiku-5-5' },
      },
    });
    expect(await claude.findByRole('button', { name: 'Replace' })).toBeVisible();
    expect(claude.queryByText(/Zx9q/)).not.toBeInTheDocument();
    expect(claude.getByLabelText('Model')).toHaveValue('claude-haiku-5-5');

    await user.click(claude.getByRole('button', { name: 'Test' }));
    expect(await claude.findByRole('status')).toHaveTextContent('Works');
    expect(requests).toContainEqual({ operation: 'TestApiKey', variables: { kind: 'ANTHROPIC' } });
  });

  it('changes the model of a saved key without pasting the key again', async () => {
    apiKeys.push({
      kind: 'ANTHROPIC',
      last4: 'Zx9q',
      model: null,
      credits: null,
      updatedAt: '2026-11-08T12:00:00.000Z',
    });
    const user = userEvent.setup();
    renderWithData(<SettingsPage />);
    const claude = await card('Claude API key');
    const model = await claude.findByLabelText('Model');
    expect(model).toHaveAttribute('placeholder', 'claude-sonnet-5-5');

    await user.type(model, 'claude-opus-5-5');
    await user.click(claude.getByRole('button', { name: 'Save model' }));

    expect(requests).toContainEqual({
      operation: 'SetApiKeyModel',
      variables: { kind: 'ANTHROPIC', model: 'claude-opus-5-5' },
    });
  });

  it('switches to OpenAI, whose chat the copy-and-open buttons then open', async () => {
    const user = userEvent.setup();
    renderWithData(<SettingsPage />);
    await card('Claude API key');

    await user.click(screen.getByRole('radio', { name: 'OpenAI (ChatGPT)' }));

    expect(requests).toContainEqual({
      operation: 'SetAiProvider',
      variables: { provider: 'OPENAI' },
    });
    expect(me.aiProvider).toBe('OPENAI');
    const openai = await card('OpenAI API key');
    expect(openai.getByLabelText('Model')).toHaveAttribute('placeholder', 'gpt-5-mini');
    expect(screen.getByText('Copy-and-open buttons open ChatGPT.')).toBeVisible();
  });

  it('shows Resume-Matcher under the AI key', async () => {
    renderWithData(<SettingsPage />);
    expect(await screen.findByRole('heading', { name: 'Resume-Matcher' })).toBeVisible();
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

  it('asks the admin for a token and shows a lent one without any part of it', async () => {
    const user = userEvent.setup();
    renderWithData(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Request a token' }));
    expect(requests).toContainEqual({ operation: 'RequestPoolKey', variables: {} });

    expect(await screen.findByText('From the admin')).toBeVisible();
    expect(screen.getByText('Limit: 500 credits · 0 used')).toBeVisible();
    expect(screen.getByText('(hidden)')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Give back to the pool' }));
    expect(requests).toContainEqual({ operation: 'GivePoolKeyBack', variables: {} });
    expect(await screen.findByRole('button', { name: 'Request a token' })).toBeVisible();
  });

  it('hides the request when you have your own token', async () => {
    apiKeys.push({
      kind: 'JOBHUNTER',
      last4: 'a9F2',
      model: null,
      credits: null,
      updatedAt: '2026-11-08T12:00:00.000Z',
    });
    renderWithData(<SettingsPage />);
    expect(await screen.findByText('✓ Saved')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Request a token' })).not.toBeInTheDocument();
  });
  it('shows a waiting request that can be cancelled', async () => {
    Object.assign(poolKey, { state: 'PENDING', requestedAt: new Date().toISOString() });
    const user = userEvent.setup();
    renderWithData(<SettingsPage />);
    expect(await screen.findByText('Request sent')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel request' }));
    expect(requests).toContainEqual({ operation: 'CancelPoolKeyRequest', variables: {} });
    expect(await screen.findByRole('button', { name: 'Request a token' })).toBeVisible();
  });

  it('says to come back in about 24 hours, with the time and what is left', async () => {
    const hour = 60 * 60 * 1000;
    Object.assign(poolKey, {
      state: 'PENDING',
      requestedAt: new Date(Date.now() - 8 * hour).toISOString(),
      readyAt: new Date(Date.now() + 16 * hour - 60_000).toISOString(),
    });
    renderWithData(<SettingsPage />);
    expect(
      await screen.findByText('Request received. Please come back in about 24 hours.'),
    ).toBeVisible();
    expect(screen.getByText(/Your key is ready after/)).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'About 16 hours left' })).toHaveAttribute(
      'aria-valuenow',
      '33',
    );
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeVisible();
  });

  it('says no key is free yet when the wait is over', async () => {
    Object.assign(poolKey, {
      state: 'PENDING',
      requestedAt: '2026-11-01T10:00:00.000Z',
      readyAt: '2026-11-02T10:00:00.000Z',
    });
    renderWithData(<SettingsPage />);
    expect(await screen.findByText('No key is free yet.')).toBeVisible();
  });

  it('shows a no with its note and the date to ask again', async () => {
    Object.assign(poolKey, {
      state: 'DENIED',
      note: 'Try later',
      askAgainAt: '2026-11-29T10:00:00.000Z',
    });
    renderWithData(<SettingsPage />);
    expect(await screen.findByText('Request denied')).toBeVisible();
    expect(screen.getByText('Note: “Try later”', { exact: false })).toBeVisible();
    expect(screen.getByText(/You can ask again on Nov 29, 2026/)).toBeVisible();
    expect(screen.getByText('use your own key')).toBeVisible();
  });

  it('offers the waiting list when the pool is empty', async () => {
    poolKey.poolEmpty = true;
    renderWithData(<SettingsPage />);
    expect(await screen.findByText('No keys are free right now.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Join the waiting list' })).toBeVisible();
  });
});
