import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { renderWithData } from '../../profile/test/render';
import { api, kitRun, requests, server } from '../../profile/test/server';
import { SettingsPage } from '../SettingsPage';

describe('Settings > Nightly apply kits', () => {
  async function card() {
    renderWithData(<SettingsPage />);
    const heading = await screen.findByRole('heading', { name: 'Nightly apply kits' });
    return within(heading.closest('section') as HTMLElement);
  }

  it('turns nightly kits on with a limit per night and a time', async () => {
    const user = userEvent.setup();
    const kits = await card();
    const perNight = await kits.findByLabelText('At most per night');
    expect(perNight).toBeDisabled();
    expect(kits.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await user.click(kits.getByLabelText(/Write my apply kits at night/));
    await user.selectOptions(perNight, '3');
    const at = kits.getByLabelText('At');
    await user.clear(at);
    await user.type(at, '22:30');
    await user.click(kits.getByRole('button', { name: 'Save' }));

    expect(requests).toContainEqual({
      operation: 'SetNightlyKits',
      variables: { input: { on: true, perNight: 3, at: '22:30' } },
    });
  });

  const RUN = {
    running: true,
    total: 3,
    done: 0,
    written: 0,
    failed: 0,
    reason: null,
    startedAt: '2026-11-24T12:00:00.000Z',
  };

  it('writes the kits now, shows the progress, then the result', async () => {
    const user = userEvent.setup();
    const kits = await card();
    const writeNow = await kits.findByRole('button', { name: 'Write now' });
    kitRun.steps = [RUN, { ...RUN, running: false, done: 3, written: 2, failed: 1 }];
    await user.click(writeNow);
    expect(requests).toContainEqual({ operation: 'WriteKitsNow', variables: {} });
    expect(await kits.findByText(/Writing kit 1 of 3/)).toBeVisible();
    expect(kits.getByRole('button', { name: 'Writing…' })).toBeDisabled();

    expect(await kits.findByText(/Wrote 2 kits\./, undefined, { timeout: 5000 })).toBeVisible();
    expect(kits.getByText(/1 could not be written/)).toBeVisible();
    expect(kits.getByRole('link', { name: 'Open Apply queue' })).toHaveAttribute('href', '/jobs');
    expect(kits.getByRole('button', { name: 'Write now' })).toBeEnabled();
  });

  it('says why the last run wrote nothing', async () => {
    kitRun.current = { ...RUN, running: false, done: 0, reason: 'KEY_REFUSED' };
    const kits = await card();
    expect(
      await kits.findByText('No kit written: your AI key was refused. Check it above.'),
    ).toBeVisible();
  });

  it('says so when the Apply queue is empty', async () => {
    server.use(
      api.mutation('WriteKitsNow', () =>
        HttpResponse.json({
          errors: [
            { message: 'empty', extensions: { apiCode: 'KITS_QUEUE_EMPTY', apiParams: {} } },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    const kits = await card();
    await user.click(await kits.findByRole('button', { name: 'Write now' }));
    expect(await kits.findByRole('alert')).toHaveTextContent(
      'Nothing to write: your Apply queue is empty. Add jobs to it on My Jobs first.',
    );
  });
});
