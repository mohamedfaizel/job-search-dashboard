import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithData } from '../test/render';
import { requests, SAVED } from '../test/server';
import { SavedSearches } from './SavedSearches';

describe('SavedSearches', () => {
  async function renderCard(onLoad = vi.fn()) {
    renderWithData(<SavedSearches onLoad={onLoad} />);
    return within(await screen.findByRole('article', { name: 'Frontend in Berlin' }));
  }

  it('shows what each search looks for and how its last import went', async () => {
    const card = await renderCard();

    expect(card.getByText('frontend · react · DE · Berlin')).toBeInTheDocument();
    expect(card.getByText(/up to 50 credits per run · only new jobs/)).toBeInTheDocument();
    expect(card.getByText(/20 new, 5 already saved, 20 credits\./)).toBeInTheDocument();
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

    await userEvent.click(card.getByRole('button', { name: 'Edit' }));

    expect(onLoad).toHaveBeenCalledWith(SAVED);
  });

  it('asks before deleting', async () => {
    const card = await renderCard();

    await userEvent.click(card.getByRole('button', { name: 'Delete' }));
    expect(requests).toHaveLength(0);
    await userEvent.click(card.getByRole('button', { name: 'Delete "Frontend in Berlin"' }));

    await vi.waitFor(() => {
      expect(requests[0]).toEqual({ operation: 'DeleteSavedSearch', variables: { id: 1 } });
    });
  });
});
