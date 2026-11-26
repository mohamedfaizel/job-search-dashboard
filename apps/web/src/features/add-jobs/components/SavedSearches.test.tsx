import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { vi } from 'vitest';
import { renderWithData } from '../test/render';
import { api, apiKeys, kitRun, requests, SAVED, server } from '../test/server';
import { SavedSearches } from './SavedSearches';

describe('SavedSearches', () => {
  async function renderCard(onLoad = vi.fn()) {
    renderWithData(<SavedSearches onLoad={onLoad} />);
    return within(await screen.findByRole('article', { name: 'Frontend in Berlin' }));
  }
  /** The schedule and Autopilot sit behind ▸ (one search open at a time). */
  async function openMore() {
    await userEvent.click(screen.getByRole('button', { name: 'Settings for Frontend in Berlin' }));
  }
  /** Delete, Copy, Rename and Pause sit in the ⋯ menu. */
  async function openMenu() {
    await userEvent.click(screen.getByRole('button', { name: 'More for Frontend in Berlin' }));
  }

  it('shows what each search looks for and how its last import went', async () => {
    const card = await renderCard();

    expect(card.getByText('frontend · react · Germany · Berlin')).toBeInTheDocument();
    expect(card.getByText('Last: 20 new')).toBeVisible();
    await openMore();
    expect(card.getByText(/up to 50 credits per run · only new jobs/)).toBeVisible();
    expect(card.getByText(/20 new, 5 already saved, 20 credits\./)).toBeVisible();
  });

  it('marks an Arbeitsagentur search and shows no credits for it', async () => {
    server.use(
      api.query('SavedSearches', () =>
        HttpResponse.json({
          data: { savedSearches: [{ ...SAVED, source: 'ARBEITSAGENTUR' }] },
        }),
      ),
    );
    const card = await renderCard();

    expect(card.getByText('Arbeitsagentur')).toBeInTheDocument();
    await openMore();
    expect(card.getByText(/Last 7 days · 0 credits · only new jobs/)).toBeInTheDocument();
    expect(card.queryByText(/credits per run/)).not.toBeInTheDocument();
    expect(card.getByText(/Last run .*: 20 new, 5 already saved\./)).toBeInTheDocument();
  });

  it('shows the companies of a career page search, and what could not be read', async () => {
    server.use(
      api.query('SavedSearches', () =>
        HttpResponse.json({
          data: {
            savedSearches: [
              {
                ...SAVED,
                source: 'COMPANY_BOARDS',
                boards: ['greenhouse:stripe', 'lever:netflix'],
              },
            ],
          },
        }),
      ),
      api.mutation('RunSavedSearch', () =>
        HttpResponse.json({
          data: {
            runSavedSearch: {
              pages: 2,
              fetched: 1,
              created: 1,
              updated: 0,
              totalAvailable: null,
              hasMore: false,
              creditsRemaining: null,
              creditsCharged: 0,
              jobsAlreadyPaid: 0,
              newSince: null,
              resumed: false,
              warnings: ['lever:netflix: 404 Not Found'],
            },
          },
        }),
      ),
    );
    const card = await renderCard();

    expect(card.getByText('Career pages')).toBeInTheDocument();
    expect(card.getByText(/greenhouse:stripe, lever:netflix · frontend/)).toBeInTheDocument();
    await userEvent.click(card.getByRole('button', { name: 'Run now' }));
    expect(
      await card.findByText(
        'Netflix (Lever): no career page found under this name. Check the spelling.',
      ),
    ).toBeInTheDocument();
  });

  it('runs a search, then continues it when pages are left', async () => {
    const card = await renderCard();

    await userEvent.click(card.getByRole('button', { name: 'Run now' }));

    expect(await card.findByRole('status')).toHaveTextContent(
      'Imported: 30 new, 20 already in your table. Used 30 credits. More pages are waiting.',
    );
    expect(requests[0]).toEqual({
      operation: 'RunSavedSearch',
      variables: { id: 1, resume: false },
    });

    await userEvent.click(card.getByRole('button', { name: 'Continue import' }));

    expect(await card.findByText(/^Continued:/)).toBeInTheDocument();
    expect(requests[1]?.variables).toEqual({ id: 1, resume: true });
  });

  it('hands the search to the form for editing', async () => {
    const onLoad = vi.fn();
    const card = await renderCard(onLoad);

    await userEvent.click(card.getByRole('button', { name: 'Edit Frontend in Berlin' }));

    expect(onLoad).toHaveBeenCalledWith(SAVED);
  });

  it('asks before deleting', async () => {
    const card = await renderCard();
    expect(card.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    await openMenu();
    await userEvent.click(card.getByRole('button', { name: 'Delete' }));
    expect(requests).toHaveLength(0);
    await userEvent.click(card.getByRole('button', { name: 'Delete "Frontend in Berlin"' }));

    await vi.waitFor(() => {
      expect(requests[0]).toEqual({ operation: 'DeleteSavedSearch', variables: { id: 1 } });
    });
  });

  it("shows today's credit budget and the schedule", async () => {
    const card = await renderCard();

    expect((await screen.findAllByText(/Today: 35 of 100 credits used/))[0]).toBeInTheDocument();
    expect(screen.getByText('35/100')).toBeVisible();
    // The folded card shows how often it runs; the controls are behind ▸.
    expect(card.getByText('⏰ Daily 07:00')).toBeVisible();
    await openMore();
    expect(card.getByRole('switch', { name: 'Run by itself' })).toBeChecked();
    expect(card.getByLabelText('Run automatically')).toHaveValue('DAILY');
    expect(card.getByLabelText('At')).toHaveValue('07:00');
    expect(card.getByText(/^Next /)).toBeVisible();
    expect(card.getByText(/^Ran at 26 Oct, 07:00/)).toBeInTheDocument();
  });

  it('saves a new schedule only after something changed', async () => {
    const card = await renderCard();
    await openMore();
    expect(card.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await userEvent.selectOptions(card.getByLabelText('Run automatically'), 'Weekdays (Mon–Fri)');
    const time = card.getByLabelText('At');
    await userEvent.clear(time);
    await userEvent.type(time, '08:30');
    await userEvent.click(card.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => {
      expect(requests[0]).toEqual({
        operation: 'SetSavedSearchSchedule',
        variables: { id: 1, input: { schedule: 'WEEKDAYS', runAt: '08:30' } },
      });
    });
  });

  it('turns Autopilot on with its rules', async () => {
    const card = await renderCard();
    await openMore();
    expect(card.queryByLabelText('Queue when Fit is at least')).not.toBeInTheDocument();

    await userEvent.click(card.getByRole('switch', { name: 'Autopilot' }));
    const queueAt = card.getByLabelText('Queue when Fit is at least');
    expect(queueAt).toHaveValue(75);
    await userEvent.clear(queueAt);
    await userEvent.type(queueAt, '80');
    await userEvent.click(card.getByLabelText('Skip jobs whose ad says no visa sponsorship'));
    await userEvent.click(card.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => {
      expect(requests).toContainEqual({
        operation: 'SetSavedSearchAutopilot',
        variables: {
          id: 1,
          input: {
            autopilot: true,
            autoQueueFitMin: 80,
            autoQueueNeedsVisa: false,
            autoHideFitBelow: 40,
            autoQueueMaxPerDay: 10,
            autoKits: false,
            kitScoreTarget: 90,
          },
        },
      });
    });
  });

  it('writes apply kits for the jobs Autopilot queues, at your target score', async () => {
    apiKeys.push({
      kind: 'ANTHROPIC',
      last4: 'wxyz',
      model: null,
      credits: null,
      updatedAt: '2026-11-08T12:00:00.000Z',
    });
    const card = await renderCard();
    await openMore();
    await userEvent.click(card.getByRole('switch', { name: 'Autopilot' }));
    expect(card.getByRole('tooltip', { name: /at most 10 a day/ })).toBeInTheDocument();
    expect(card.queryByLabelText('Target score')).not.toBeInTheDocument();

    await userEvent.click(card.getByLabelText('Write apply kits for the jobs it queues'));
    const target = card.getByLabelText('Target score');
    expect(target).toHaveValue('90');
    fireEvent.change(target, { target: { value: '85' } });
    await userEvent.click(card.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => {
      expect(requests).toContainEqual({
        operation: 'SetSavedSearchAutopilot',
        variables: {
          id: 1,
          input: expect.objectContaining({ autopilot: true, autoKits: true, kitScoreTarget: 85 }),
        },
      });
    });
  });

  it('asks for an AI key before it can write kits, and Cancel undoes changes', async () => {
    const card = await renderCard();
    await openMore();
    await userEvent.click(card.getByRole('switch', { name: 'Autopilot' }));

    expect(await card.findByText('Needs your Claude or OpenAI key.')).toBeInTheDocument();
    expect(card.getByLabelText('Write apply kits for the jobs it queues')).toBeDisabled();
    expect(card.getByRole('link', { name: 'Add your key' })).toHaveAttribute(
      'href',
      '/settings?tab=keys',
    );

    await userEvent.click(card.getByRole('button', { name: 'Cancel' }));
    expect(card.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(card.queryByLabelText('Queue when Fit is at least')).not.toBeInTheDocument();
  });

  it('shows the kits being written, and a Kits badge', async () => {
    kitRun.current = {
      running: true,
      total: 3,
      done: 1,
      written: 1,
      failed: 0,
      reason: null,
      startedAt: '2026-11-26T07:00:00.000Z',
    };
    server.use(
      api.query('SavedSearches', () =>
        HttpResponse.json({
          data: { savedSearches: [{ ...SAVED, autopilot: true, autoKits: true }] },
        }),
      ),
    );
    const card = await renderCard();
    expect(card.getByText('Auto ≥75%')).toBeVisible();
    expect(card.getByText('Kits 90%')).toBeVisible();
    await openMore();
    expect(await card.findByText(/Writing kit 2 of 3/)).toBeInTheDocument();
  });

  it('hides the time when the schedule is off', async () => {
    const card = await renderCard();
    await openMore();

    await userEvent.click(card.getByRole('switch', { name: 'Run by itself' }));

    expect(card.queryByLabelText('At')).not.toBeInTheDocument();
    await userEvent.click(card.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => {
      expect(requests[0]).toEqual({
        operation: 'SetSavedSearchSchedule',
        variables: { id: 1, input: { schedule: 'OFF', runAt: '07:00' } },
      });
    });
  });

  it('marks the search that is in the form', async () => {
    renderWithData(<SavedSearches onLoad={vi.fn()} loadedId={1} />);
    const card = within(await screen.findByRole('article', { name: 'Frontend in Berlin' }));

    expect(card.getByText('In the form')).toBeInTheDocument();
  });

  it('tells a new user how to make their first one', async () => {
    server.use(
      api.query('SavedSearches', () => HttpResponse.json({ data: { savedSearches: [] } })),
    );
    renderWithData(<SavedSearches onLoad={vi.fn()} />);

    expect(await screen.findByText(/None yet\. Fill in the form/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument();
  });

  it('can fold the list away, for phones', async () => {
    await renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));

    expect(screen.getByRole('button', { name: 'Show' })).toHaveAttribute('aria-expanded', 'false');
  });
  it('keeps one search open at a time', async () => {
    server.use(
      api.query('SavedSearches', () =>
        HttpResponse.json({
          data: { savedSearches: [SAVED, { ...SAVED, id: 2, name: 'Munich React' }] },
        }),
      ),
    );
    await renderCard();
    const first = screen.getByRole('button', { name: 'Settings for Frontend in Berlin' });
    const second = screen.getByRole('button', { name: 'Settings for Munich React' });

    await userEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(second);

    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
  });

  it('pauses, copies and renames from the ⋯ menu', async () => {
    const card = await renderCard();

    await openMenu();
    await userEvent.click(card.getByRole('button', { name: 'Pause schedule' }));
    await vi.waitFor(() => {
      expect(requests).toContainEqual({
        operation: 'SetSavedSearchSchedule',
        variables: { id: 1, input: { schedule: 'OFF', runAt: '07:00' } },
      });
    });

    await openMenu();
    await userEvent.click(card.getByRole('button', { name: 'Copy search' }));
    await vi.waitFor(() => {
      expect(requests).toContainEqual({
        operation: 'CreateSavedSearch',
        variables: { input: expect.objectContaining({ name: 'Frontend in Berlin (copy)' }) },
      });
    });

    await openMenu();
    await userEvent.click(card.getByRole('button', { name: 'Rename' }));
    const name = card.getByLabelText('New name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Berlin UI');
    await userEvent.click(card.getByRole('button', { name: 'Save name' }));
    await vi.waitFor(() => {
      expect(requests).toContainEqual({
        operation: 'UpdateSavedSearch',
        variables: {
          id: 1,
          input: expect.objectContaining({ name: 'Berlin UI', titles: ['frontend'] }),
        },
      });
    });
  });

  it('shows the kit cost-saving settings once the API sends them', async () => {
    apiKeys.push({
      kind: 'ANTHROPIC',
      last4: 'wxyz',
      model: null,
      credits: null,
      updatedAt: '2026-11-08T12:00:00.000Z',
    });
    server.use(
      api.query('SavedSearches', () =>
        HttpResponse.json({
          data: {
            savedSearches: [
              {
                ...SAVED,
                autopilot: true,
                autoKits: true,
                kitUseMaster: true,
                kitMasterMin: 90,
                kitWriteResume: true,
                kitWriteCover: true,
                kitWriteAnswers: true,
                lastKitRun: { kits: 6, costCents: 31, savedPercent: 23, currency: 'EUR' },
              },
            ],
          },
        }),
      ),
    );
    const card = await renderCard();
    await openMore();

    expect(card.getByText(/Last run: 6 kits · €0\.31/)).toBeVisible();
    expect(card.getByText('saved 23%')).toBeVisible();
    await userEvent.click(card.getByRole('button', { name: 'Form answers' }));
    await userEvent.click(card.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => {
      expect(requests).toContainEqual({
        operation: 'SetSavedSearchAutopilot',
        variables: {
          id: 1,
          input: expect.objectContaining({ kitUseMaster: true, kitWriteAnswers: false }),
        },
      });
    });
  });
});
