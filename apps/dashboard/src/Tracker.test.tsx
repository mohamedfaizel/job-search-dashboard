import type { Application } from '@jobsearch/data';
import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JOBS } from './test/fixtures';
import { applications, requests } from './test/server';
import { TrackerPage } from './Tracker';

function renderTracker(start: Application[] = []) {
  applications.push(...start);
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <DataProvider store={makeStore()} queryClient={queryClient}>
      <TrackerPage />
    </DataProvider>,
  );
}

const [FRONTEND, BACKEND] = JOBS as [(typeof JOBS)[number], (typeof JOBS)[number]];
const tracked = (job: typeof FRONTEND, status: Application['status']): Application => ({
  status,
  updatedAt: '2026-10-26T09:00:00.000Z',
  job: { ...job, applicationStatus: status },
});
const column = (name: RegExp) => screen.getByRole('region', { name });

/** jsdom has no DataTransfer, so drag events get a small stand-in. */
function dataTransfer() {
  const data: Record<string, string> = {};
  return {
    setData: (type: string, value: string) => {
      data[type] = value;
    },
    getData: (type: string) => data[type] ?? '',
    get types() {
      return Object.keys(data);
    },
    effectAllowed: 'all',
  };
}

describe('Tracker board', () => {
  it('puts each tracked job in its status column', async () => {
    renderTracker([tracked(FRONTEND, 'APPLIED'), tracked(BACKEND, 'SAVED')]);

    expect(await screen.findByRole('button', { name: FRONTEND.title })).toBeInTheDocument();
    expect(within(column(/^Applied/)).getByText(FRONTEND.title)).toBeInTheDocument();
    expect(within(column(/^Saved/)).getByText(BACKEND.title)).toBeInTheDocument();
    expect(column(/^Interviewing/)).toHaveTextContent('Interviewing (0)');
    expect(within(column(/^Saved/)).getByText('Moved Oct 26, 2026')).toBeInTheDocument();
  });

  it('moves a card with its status menu', async () => {
    const user = userEvent.setup();
    renderTracker([tracked(FRONTEND, 'APPLIED')]);

    await user.selectOptions(
      await screen.findByRole('combobox', { name: `Status for ${FRONTEND.title} at Acme` }),
      'Interviewing',
    );

    await waitFor(() => {
      expect(within(column(/^Interviewing/)).getByText(FRONTEND.title)).toBeInTheDocument();
    });
    expect(column(/^Applied/)).toHaveTextContent('Applied (0)');
    expect(requests).toContainEqual({
      operation: 'UpdateJobStatus',
      variables: { id: FRONTEND.id, status: 'INTERVIEWING' },
    });
  });

  it('moves a card by dragging it to another column', async () => {
    renderTracker([tracked(BACKEND, 'SAVED')]);
    const card = (await screen.findByText(BACKEND.title)).closest('li')!;
    const transfer = dataTransfer();

    fireEvent.dragStart(card, { dataTransfer: transfer });
    fireEvent.dragOver(column(/^Offer/), { dataTransfer: transfer });
    fireEvent.drop(column(/^Offer/), { dataTransfer: transfer });

    await waitFor(() => {
      expect(within(column(/^Offer/)).getByText(BACKEND.title)).toBeInTheDocument();
    });
    expect(requests).toContainEqual({
      operation: 'UpdateJobStatus',
      variables: { id: BACKEND.id, status: 'OFFER' },
    });
  });

  it('takes a job off the board when set back to Not applied', async () => {
    const user = userEvent.setup();
    renderTracker([tracked(FRONTEND, 'REJECTED')]);

    await user.selectOptions(
      await screen.findByRole('combobox', { name: `Status for ${FRONTEND.title} at Acme` }),
      'Not applied',
    );

    expect(await screen.findByText(/Nothing on your tracker yet/)).toBeInTheDocument();
  });

  it('opens the job details from a card', async () => {
    const user = userEvent.setup();
    renderTracker([tracked(FRONTEND, 'SAVED')]);

    await user.click(await screen.findByRole('button', { name: FRONTEND.title }));

    expect(screen.getByRole('dialog', { name: FRONTEND.title })).toBeInTheDocument();
  });
});
