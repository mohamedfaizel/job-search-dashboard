import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../test/render';
import { requests } from '../test/server';
import { SyncPanel } from './SyncPanel';

describe('SyncPanel', () => {
  it('shows the credit cost and imports jobs', async () => {
    renderWithData(<SyncPanel />);
    const countries = screen.getByLabelText(/countries/i);
    await userEvent.type(countries, 'de');
    const maxPages = screen.getByLabelText('Max pages');
    await userEvent.clear(maxPages);
    await userEvent.type(maxPages, '2');

    await userEvent.click(screen.getByRole('button', { name: 'Import (up to 50 credits)' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Looked for jobs found since');
    expect(status).toHaveTextContent(
      'Fetched 25 jobs: 20 new, 5 already in your table (updated, not added twice).',
    );
    expect(status).toHaveTextContent('80 jobs match this search in total.');
    expect(status).toHaveTextContent(
      'Used 20 credits (5 jobs already paid this month, so free), 741 left.',
    );
    expect(requests[0]?.variables).toEqual({
      input: {
        titles: ['frontend'],
        skills: ['react'],
        countryCodes: ['DE'],
        maxAgeDays: 7,
        pageSize: 25,
        maxPages: 2,
        onlyNew: true,
      },
    });
  });

  it('sends cities or regions', async () => {
    renderWithData(<SyncPanel />);
    await userEvent.type(screen.getByLabelText(/cities or regions/i), 'Berlin, Bavaria');
    await userEvent.click(screen.getByRole('button', { name: /^import/i }));

    await screen.findByRole('status');
    expect(requests[0]?.variables).toMatchObject({ input: { locations: ['Berlin', 'Bavaria'] } });
  });

  it('continues an import that stopped with pages left', async () => {
    renderWithData(<SyncPanel />);
    await userEvent.click(screen.getByRole('button', { name: /^import/i }));
    const resume = await screen.findByRole('button', {
      name: 'Continue import (up to 25 credits)',
    });

    await userEvent.click(resume);

    expect(await screen.findByText(/Continued the last import/)).toBeInTheDocument();
    expect(requests[1]?.variables).toEqual({
      input: { ...(requests[0]?.variables['input'] as object), resume: true },
    });
    expect(screen.queryByRole('button', { name: /continue import/i })).not.toBeInTheDocument();
  });

  it('can fetch everything again instead of only new jobs', async () => {
    renderWithData(<SyncPanel />);
    const onlyNew = screen.getByRole('checkbox', { name: 'Only jobs new since my last import' });
    expect(onlyNew).toBeChecked();

    await userEvent.click(onlyNew);
    await userEvent.click(screen.getByRole('button', { name: /^import/i }));

    const status = await screen.findByRole('status');
    expect(status).not.toHaveTextContent('Looked for jobs found since');
    expect(requests[0]?.variables).toMatchObject({ input: { onlyNew: false } });
  });

  it('needs at least one job title', async () => {
    renderWithData(<SyncPanel />);
    await userEvent.clear(screen.getByLabelText(/job titles/i));
    await userEvent.click(screen.getByRole('button', { name: /^import/i }));

    expect(await screen.findByText('Enter at least one job title')).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });
});
