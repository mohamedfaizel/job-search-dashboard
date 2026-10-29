import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { JobsDashboard } from './JobsDashboard';
import { makeJob } from './test/fixtures';
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

// The "Jobs found" card asks for a one-row page just to read the total; skip that one.
const lastJobsPageVariables = () =>
  requests.filter((r) => r.operation === 'JobsPage' && r.variables['pageSize'] !== 1).at(-1)
    ?.variables;

const card = (name: RegExp) => screen.getByRole('button', { name });

describe('JobsDashboard', () => {
  it('shows jobs from the API', async () => {
    renderDashboard();

    expect(
      await screen.findByRole('button', { name: 'Senior Frontend Engineer' }),
    ).toBeInTheDocument();
    const row = screen.getByRole('button', { name: 'Senior Frontend Engineer' }).closest('tr')!;
    // The company sits under the title, and the country and workplace under the city.
    expect(within(row).getByText('Acme')).toBeInTheDocument();
    expect(within(row).getByText('$90k - $120k')).toBeInTheDocument();
    expect(within(row).getByText('Berlin')).toBeInTheDocument();
    expect(within(row).getByText('Germany · Remote')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: /Open posting for Senior/ })).toHaveAttribute(
      'href',
      'https://example.com/jobs/1',
    );
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

    // The Job column filters by company.
    await userEvent.click(screen.getByRole('button', { name: 'Filter Company' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Acme' }));

    await waitFor(() => {
      expect(lastJobsPageVariables()).toMatchObject({
        filter: { companies: ['Acme'] },
        page: 1,
      });
    });
    expect(screen.getByRole('button', { name: 'Filter Company (1 selected)' })).toBeInTheDocument();
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

  it('shows your match score in the Match column', async () => {
    server.use(
      api.query('JobsPage', () =>
        HttpResponse.json({
          data: {
            jobsPage: {
              items: [
                makeJob({ matchStatus: 'READY', matchScore: 81.6 }),
                makeJob({ id: 'job-2', title: 'Backend Developer', matchStatus: 'PENDING' }),
              ],
              total: 2,
              page: 1,
              pageSize: 25,
            },
          },
        }),
      ),
    );
    renderDashboard();

    const score = await screen.findByRole('button', {
      name: 'Resume match for Senior Frontend Engineer: 82',
    });
    expect(screen.getByText('Matching…')).toBeInTheDocument();

    await userEvent.click(score);
    expect(screen.getByRole('dialog', { name: 'Senior Frontend Engineer' })).toBeInTheDocument();
  });

  it('hides and shows columns from the Columns menu, and remembers the choice', async () => {
    renderDashboard();
    await screen.findByRole('button', { name: 'Senior Frontend Engineer' });
    expect(screen.getByRole('columnheader', { name: /Salary/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Columns/ }));
    const menu = screen.getByRole('dialog', { name: 'Show or hide columns' });
    // The title opens the popup, so it can't be switched off.
    expect(within(menu).getByRole('checkbox', { name: /^Job/ })).toBeDisabled();
    await userEvent.click(within(menu).getByRole('checkbox', { name: 'Salary' }));

    expect(screen.queryByRole('columnheader', { name: /Salary/ })).not.toBeInTheDocument();
    expect(screen.queryByText('$90k - $120k')).not.toBeInTheDocument();
    // Salary plus the seven columns that start hidden.
    expect(screen.getByRole('button', { name: /Columns/ })).toHaveTextContent('8 hidden');
    expect(localStorage.getItem('jobsearch.dashboard.columns')).toBe('{"salary":false}');

    await userEvent.click(within(menu).getByRole('button', { name: 'Show all columns' }));
    expect(screen.getByRole('columnheader', { name: /Salary/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Industry/ })).toBeInTheDocument();

    // Columns that read a field (Skills) have ids too, so only that one goes.
    await userEvent.click(within(menu).getByRole('checkbox', { name: 'Skills' }));
    expect(screen.queryByRole('columnheader', { name: /Skills/ })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Seniority/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Columns/ })).toHaveTextContent('1 hidden');
  });

  it('starts with only the columns you decide on, the rest in the menu', async () => {
    renderDashboard();
    await screen.findByRole('button', { name: 'Senior Frontend Engineer' });

    for (const name of [/Skills/, /Seniority/, /Language/, /Source/, /Workplace/, /Industry/]) {
      expect(screen.queryByRole('columnheader', { name })).not.toBeInTheDocument();
    }
    for (const name of [/^Job/, /Match/, /Location/, /Posted/, /Salary/, /Status/]) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('button', { name: /Columns/ }));
    const menu = screen.getByRole('dialog', { name: 'Show or hide columns' });
    expect(within(menu).getByRole('checkbox', { name: 'Workplace' })).not.toBeChecked();
    await userEvent.click(within(menu).getByRole('checkbox', { name: 'Workplace' }));
    expect(screen.getByRole('columnheader', { name: /Workplace/ })).toBeInTheDocument();
    expect(localStorage.getItem('jobsearch.dashboard.columns')).toBe('{"workplace":true}');
  });

  it('starts with the columns hidden on an earlier visit', async () => {
    localStorage.setItem('jobsearch.dashboard.hiddenColumns', '["salary","match"]');
    renderDashboard();
    await screen.findByRole('button', { name: 'Senior Frontend Engineer' });

    expect(screen.queryByRole('columnheader', { name: /Salary/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Match/ })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Location/ })).toBeInTheDocument();
  });

  it('shows counts above the table', async () => {
    renderDashboard();

    const jobsFound = (await screen.findByText('Jobs found')).closest('button')!;
    await waitFor(() => {
      expect(within(jobsFound).getByText('2')).toBeInTheDocument();
    });
    expect(jobsFound).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a card’s jobs in the table when you click it', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('button', { name: 'Senior Frontend Engineer' });

    await user.click(card(/^Applied/));
    await waitFor(() => {
      expect(lastJobsPageVariables()).toMatchObject({
        filter: { applicationStatuses: ['APPLIED'] },
      });
    });
    expect(card(/^Applied/)).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Senior Frontend Engineer' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Backend Developer' })).toBeInTheDocument();
    // "Jobs found" still counts every status.
    expect(within(card(/^Jobs found/)).getByText('2')).toBeInTheDocument();

    // Clicking the card that is on goes back to all jobs.
    await user.click(card(/^Applied/));
    expect(card(/^Jobs found/)).toHaveAttribute('aria-pressed', 'true');
    expect(lastJobsPageVariables()).not.toHaveProperty('filter');
  });

  it('maximizes the job popup and restores it', async () => {
    renderDashboard();
    await userEvent.click(await screen.findByRole('button', { name: 'Senior Frontend Engineer' }));
    const dialog = screen.getByRole('dialog', { name: 'Senior Frontend Engineer' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Maximize' }));
    expect(dialog).toHaveClass('w-screen');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore size' }));
    expect(dialog).toHaveClass('max-w-3xl');
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

  it('hides a job, lists it under Hidden jobs and brings it back', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(
      await screen.findByRole('button', { name: 'Hide Senior Frontend Engineer at Acme' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Hid “Senior Frontend Engineer” at Acme.',
    );
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Senior Frontend Engineer' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Backend Developer' })).toBeInTheDocument();

    await waitFor(() => {
      expect(within(card(/^Hidden/)).getByText('1')).toBeInTheDocument();
    });
    await user.click(card(/^Hidden/));

    expect(screen.getByRole('heading', { name: 'Hidden jobs' })).toBeInTheDocument();
    expect(lastJobsPageVariables()).toMatchObject({ filter: { hidden: true } });
    await user.click(
      await screen.findByRole('button', { name: 'Unhide Senior Frontend Engineer at Acme' }),
    );
    expect(await screen.findByText('No hidden jobs match.')).toBeInTheDocument();

    await user.click(card(/^Jobs found/));
    expect(
      await screen.findByRole('button', { name: 'Senior Frontend Engineer' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Job posts' })).toBeInTheDocument();
  });

  it('undoes a hide', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(
      await screen.findByRole('button', { name: 'Hide Backend Developer at Beta GmbH' }),
    );

    await user.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(await screen.findByRole('button', { name: 'Backend Developer' })).toBeInTheDocument();
    expect(requests.map((r) => r.operation)).toContain('UnhideJob');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

  it('filters from the quick filter chips', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('button', { name: 'Senior Frontend Engineer' });

    await user.click(screen.getByRole('button', { name: 'Remote' }));
    expect(screen.getByRole('button', { name: 'Remote' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Country' }));
    await user.click(screen.getByRole('checkbox', { name: 'Germany' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Posted' }), '3');

    await waitFor(() => {
      expect(lastJobsPageVariables()).toMatchObject({
        filter: {
          workplaces: ['REMOTE'],
          countryCodes: ['DE'],
          postedAfter: expect.any(String) as unknown,
        },
      });
    });
    expect(screen.getByText('3 filters active')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByRole('combobox', { name: 'Posted' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Remote' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('saves a job with the bookmark icon', async () => {
    renderDashboard();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Save Senior Frontend Engineer at Acme' }),
    );

    await waitFor(() => {
      expect(requests).toContainEqual({
        operation: 'UpdateJobStatus',
        variables: { id: 'job-1', status: 'SAVED' },
      });
    });
    // Backend Developer is already Applied, so there is nothing to save.
    expect(
      screen.getByRole('button', { name: 'Save Backend Developer at Beta GmbH' }),
    ).toBeDisabled();
  });

  it('hides several ticked jobs at once and undoes it', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('button', { name: 'Senior Frontend Engineer' });

    await user.click(screen.getByRole('checkbox', { name: 'Select all jobs on this page' }));
    const bar = screen.getByRole('region', { name: 'Selected jobs' });
    expect(bar).toHaveTextContent('2 selected');
    await user.click(within(bar).getByRole('button', { name: 'Hide' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Hid 2 jobs.');
    expect(requests.filter((r) => r.operation === 'HideJob')).toHaveLength(2);
    expect(screen.queryByRole('region', { name: 'Selected jobs' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(requests.filter((r) => r.operation === 'UnhideJob')).toHaveLength(2);
    });
  });

  it('asks "Did you apply?" after you open a posting from the Apply kit', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Senior Frontend Engineer' }));
    const dialog = screen.getByRole('dialog', { name: 'Senior Frontend Engineer' });

    await user.click(await within(dialog).findByRole('link', { name: /Open posting/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    const ask = screen.getByRole('list', { name: 'Did you apply?' });
    expect(ask).toHaveTextContent('Did you apply to Senior Frontend Engineer at Acme?');
    // Kept in this browser, so the question is still there after a reload.
    expect(localStorage.getItem('jobsearch.dashboard.applying')).toContain('job-1');

    await user.click(within(ask).getByRole('button', { name: 'Yes, mark Applied' }));
    await waitFor(() => {
      expect(requests).toContainEqual({
        operation: 'UpdateJobStatus',
        variables: { id: 'job-1', status: 'APPLIED' },
      });
    });
    expect(screen.queryByRole('list', { name: 'Did you apply?' })).not.toBeInTheDocument();
  });

  it('adds ticked jobs to the Apply queue and marks them all Applied', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('button', { name: 'Senior Frontend Engineer' });
    expect(screen.queryByRole('region', { name: /Apply queue/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select all jobs on this page' }));
    const bar = screen.getByRole('region', { name: 'Selected jobs' });
    await user.click(within(bar).getByRole('button', { name: 'Add to Apply queue' }));

    expect(requests).toContainEqual({
      operation: 'AddToApplyQueue',
      variables: { jobIds: ['job-1', 'job-2'] },
    });
    const queue = await screen.findByRole('region', { name: 'Apply queue (2)' });
    expect(queue).toHaveTextContent('2 jobs have no Claude reply saved yet');
    expect(within(queue).getByRole('link', { name: 'Open queue page ↗' })).toHaveAttribute(
      'href',
      'http://localhost:3000/apply-queue',
    );
    await user.click(
      within(queue).getByRole('button', { name: 'Copy prompt for Claude in Chrome' }),
    );
    expect(
      within(queue).getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Prompt for the Apply queue',
      }).value,
    ).toContain('Never click Submit');

    await user.click(
      within(queue).getByRole('button', { name: 'Remove Backend Developer from the queue' }),
    );
    expect(await screen.findByRole('region', { name: 'Apply queue (1)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark all Applied' }));
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /Apply queue/ })).not.toBeInTheDocument();
    });
    expect(requests).toContainEqual({
      operation: 'UpdateJobStatus',
      variables: { id: 'job-1', status: 'APPLIED' },
    });
  });

  it('adds a job to the Apply queue from its popup', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Senior Frontend Engineer' }));
    const dialog = screen.getByRole('dialog', { name: 'Senior Frontend Engineer' });

    await user.click(await within(dialog).findByRole('button', { name: 'Add to Apply queue' }));
    expect(
      await within(dialog).findByRole('button', { name: 'Remove from Apply queue' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('In your Apply queue.')).toBeInTheDocument();
  });
});
