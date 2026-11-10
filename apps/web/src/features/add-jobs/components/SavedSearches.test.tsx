import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { vi } from 'vitest';
import { renderWithData } from '../test/render';
import { api, requests, SAVED, server } from '../test/server';
import { SavedSearches } from './SavedSearches';

describe('SavedSearches', () => {
  async function renderCard(onLoad = vi.fn()) {
    renderWithData(<SavedSearches onLoad={onLoad} />);
    return within(await screen.findByRole('article', { name: 'Frontend in Berlin' }));
  }
  /** The schedule and Delete sit behind the "more" button. */
  async function openMore() {
    await userEvent.click(screen.getByRole('button', { name: 'More for Frontend in Berlin' }));
  }

  it('shows what each search looks for and how its last import went', async () => {
    const card = await renderCard();

    expect(card.getByText('frontend · react · Germany · Berlin')).toBeInTheDocument();
    expect(card.getByText(/up to 50 credits per run · only new jobs/)).toBeInTheDocument();
    expect(card.getByText(/20 new, 5 already saved, 20 credits\./)).toBeInTheDocument();
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
    expect(await card.findByText('lever:netflix: 404 Not Found')).toBeInTheDocument();
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

    await openMore();
    await userEvent.click(card.getByRole('button', { name: 'Delete' }));
    expect(requests).toHaveLength(0);
    await userEvent.click(card.getByRole('button', { name: 'Delete "Frontend in Berlin"' }));

    await vi.waitFor(() => {
      expect(requests[0]).toEqual({ operation: 'DeleteSavedSearch', variables: { id: 1 } });
    });
  });

  it("shows today's credit budget and the schedule", async () => {
    const card = await renderCard();

    expect(await screen.findByText(/Today: 35 of 100 credits used/)).toBeInTheDocument();
    // The row shows how often it runs; the controls are behind "more".
    expect(card.getAllByText('Every day')[0]).toBeVisible();
    await openMore();
    expect(card.getByLabelText('Run automatically')).toHaveValue('DAILY');
    expect(card.getByLabelText('At')).toHaveValue('07:00');
    expect(card.getByText(/^Next run:/)).toBeInTheDocument();
    expect(card.getByText(/^Ran at 26 Oct, 07:00/)).toBeInTheDocument();
  });

  it('saves a new schedule only after something changed', async () => {
    const card = await renderCard();
    await openMore();
    expect(card.queryByRole('button', { name: 'Save schedule' })).not.toBeInTheDocument();

    await userEvent.selectOptions(card.getByLabelText('Run automatically'), 'Weekdays (Mon–Fri)');
    const time = card.getByLabelText('At');
    await userEvent.clear(time);
    await userEvent.type(time, '08:30');
    await userEvent.click(card.getByRole('button', { name: 'Save schedule' }));

    await vi.waitFor(() => {
      expect(requests[0]).toEqual({
        operation: 'SetSavedSearchSchedule',
        variables: { id: 1, input: { schedule: 'WEEKDAYS', runAt: '08:30' } },
      });
    });
  });

  it('hides the time when the schedule is off', async () => {
    const card = await renderCard();
    await openMore();

    await userEvent.selectOptions(card.getByLabelText('Run automatically'), 'Off');

    expect(card.queryByLabelText('At')).not.toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Save schedule' })).toBeEnabled();
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
});
