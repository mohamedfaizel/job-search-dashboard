import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { JobsDashboard } from './JobsDashboard';
import { api, requests, server } from './test/server';

function renderDashboard() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <DataProvider store={makeStore()} queryClient={queryClient}>
      <JobsDashboard />
    </DataProvider>,
  );
}

const lastJobsPageVariables = () =>
  requests.filter((r) => r.operation === 'JobsPage').at(-1)?.variables;

describe('JobsDashboard', () => {
  it('shows jobs from the API', async () => {
    renderDashboard();

    expect(
      await screen.findByRole('button', { name: 'Senior Frontend Engineer' }),
    ).toBeInTheDocument();
    const row = screen.getByRole('button', { name: 'Senior Frontend Engineer' }).closest('tr')!;
    expect(within(row).getByText('Acme')).toBeInTheDocument();
    expect(within(row).getByText('$90k - $120k')).toBeInTheDocument();
    expect(within(row).getByText('Remote')).toBeInTheDocument();
    expect(within(row).getByText('+1')).toBeInTheDocument(); // 3 skills: 2 shown, +1
    expect(screen.getByText('Showing 1–2 of 2')).toBeInTheDocument();
  });

  it('sorts on the server when a header is clicked', async () => {
    renderDashboard();
    await screen.findByRole('button', { name: 'Senior Frontend Engineer' });

    await userEvent.click(screen.getByRole('button', { name: /salary/i }));
    await waitFor(() => {
      expect(lastJobsPageVariables()).toMatchObject({
        sort: { field: 'SALARY', direction: 'ASC' },
      });
    });
    expect(screen.getByRole('columnheader', { name: /salary/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('filters by a column value', async () => {
    renderDashboard();
    await screen.findByRole('button', { name: 'Senior Frontend Engineer' });

    await userEvent.click(screen.getByRole('button', { name: 'Filter Workplace' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Remote' }));

    await waitFor(() => {
      expect(lastJobsPageVariables()).toMatchObject({
        filter: { workplaces: ['REMOTE'] },
        page: 1,
      });
    });
    expect(
      screen.getByRole('button', { name: 'Filter Workplace (1 selected)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 filter active')).toBeInTheDocument();
  });

  it('opens the description in a popup', async () => {
    renderDashboard();
    await userEvent.click(await screen.findByRole('button', { name: 'Senior Frontend Engineer' }));

    const dialog = screen.getByRole('dialog', { name: 'Senior Frontend Engineer' });
    expect(within(dialog).getByText(/build the dashboard of the future/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /open original posting/i })).toHaveAttribute(
      'href',
      'https://example.com/jobs/1',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(
      screen.queryByRole('dialog', { name: 'Senior Frontend Engineer' }),
    ).not.toBeInTheDocument();
  });

  it('updates the application status from the table', async () => {
    renderDashboard();
    const select = await screen.findByRole('combobox', {
      name: 'Status for Senior Frontend Engineer at Acme',
    });

    await userEvent.selectOptions(select, 'Applied');

    await waitFor(() => {
      expect(requests).toContainEqual({
        operation: 'UpdateJobStatus',
        variables: { id: 'job-1', status: 'APPLIED' },
      });
    });
  });

  it('shows the API error when loading fails', async () => {
    server.use(
      api.query('JobsPage', () => HttpResponse.json({ errors: [{ message: 'Database is down' }] })),
    );
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load jobs: Database is down',
    );
  });
});
