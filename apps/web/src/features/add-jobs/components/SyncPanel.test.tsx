import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithData } from '../test/render';
import { requests, SAVED } from '../test/server';
import { SyncPanel } from './SyncPanel';

describe('SyncPanel', () => {
  it('fills the search from the profile, keeping fields the profile leaves empty', async () => {
    renderWithData(<SyncPanel />);

    await userEvent.click(await screen.findByRole('button', { name: 'Fill from my profile' }));

    expect(screen.getByLabelText(/job titles/i)).toHaveValue('Frontend Engineer, React Developer');
    expect(screen.getByLabelText(/cities or regions/i)).toHaveValue('Berlin');
    // The profile has no skills, so the search keeps its own.
    expect(screen.getByLabelText(/^skills/i)).toHaveValue('react');
  });

  it('shows the credit cost and imports jobs', async () => {
    renderWithData(<SyncPanel />);
    const countries = screen.getByRole('combobox', { name: 'Countries' });
    await userEvent.type(countries, 'germ{Enter}');
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

  it('folds the page settings away and opens them on a mistake', async () => {
    renderWithData(<SyncPanel />);
    const fold = screen.getByText('Page settings').closest('details');
    expect(fold).not.toHaveAttribute('open');
    expect(fold).toHaveTextContent('7 days old at most · 25 per page · 1 page');

    await userEvent.click(screen.getByText('Page settings'));
    const pageSize = screen.getByLabelText('Jobs per page');
    await userEvent.clear(pageSize);
    await userEvent.type(pageSize, '0');
    await userEvent.click(screen.getByText('Page settings'));
    expect(fold).not.toHaveAttribute('open');

    await userEvent.click(screen.getByRole('button', { name: /^import/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(fold).toHaveAttribute('open');
    expect(requests).toHaveLength(0);
  });

  it('sends the extra filters from More filters', async () => {
    renderWithData(<SyncPanel />);
    await userEvent.click(screen.getByText('More filters'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'English' }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: /Skip ads that need fluent German/ }),
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Remote only' }));
    await userEvent.type(screen.getByLabelText('Skip titles with'), 'Werkstudent, Praktikum');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Full-time' }));
    await userEvent.type(screen.getByLabelText('Minimum salary (€ a year)'), '60000');
    expect(screen.getByText('More filters')).toHaveTextContent('6 on');

    await userEvent.click(screen.getByRole('button', { name: /^import/i }));

    await screen.findByRole('status');
    expect(requests[0]?.variables).toMatchObject({
      input: {
        languages: ['en'],
        skipFluentGerman: true,
        remoteOnly: true,
        excludeTitles: ['Werkstudent', 'Praktikum'],
        employmentTypes: ['full-time'],
        minSalaryEur: 60000,
      },
    });
  });

  it('opens More filters when a loaded search uses them', () => {
    renderWithData(<SyncPanel loaded={{ ...SAVED, remoteOnly: true }} />);
    expect(screen.getByText('More filters').closest('details')).toHaveAttribute('open');
    expect(screen.getByRole('checkbox', { name: 'Remote only' })).toBeChecked();
  });

  describe('saving the search', () => {
    it('saves the form as a named search', async () => {
      renderWithData(<SyncPanel />);
      await userEvent.type(screen.getByLabelText(/cities or regions/i), 'Berlin');
      await userEvent.type(screen.getByLabelText('Save this search as'), 'Frontend in Berlin');

      await userEvent.click(screen.getByRole('button', { name: 'Save search' }));

      expect(await screen.findByText('Saved "Frontend in Berlin".')).toBeInTheDocument();
      expect(requests[0]).toEqual({
        operation: 'CreateSavedSearch',
        variables: {
          input: {
            name: 'Frontend in Berlin',
            titles: ['frontend'],
            skills: ['react'],
            locations: ['Berlin'],
            maxAgeDays: 7,
            pageSize: 25,
            maxPages: 1,
            onlyNew: true,
          },
        },
      });
    });

    it('needs a name', async () => {
      renderWithData(<SyncPanel />);
      await userEvent.click(screen.getByRole('button', { name: 'Save search' }));

      expect(await screen.findByText('Give the search a name')).toBeInTheDocument();
      expect(requests).toHaveLength(0);
    });

    it('starts from a loaded search and updates it', async () => {
      renderWithData(<SyncPanel loaded={SAVED} />);
      expect(screen.getByLabelText(/cities or regions/i)).toHaveValue('Berlin');
      expect(screen.getByLabelText('Max pages')).toHaveValue('2');

      await userEvent.click(screen.getByRole('button', { name: 'Update saved search' }));

      await screen.findByText('Saved "Frontend in Berlin".');
      expect(requests[0]).toMatchObject({ operation: 'UpdateSavedSearch', variables: { id: 1 } });
    });

    it('saves a renamed copy as a new search', async () => {
      renderWithData(<SyncPanel loaded={SAVED} />);
      const name = screen.getByLabelText('Save this search as');
      await userEvent.clear(name);
      await userEvent.type(name, 'Frontend in Munich');

      await userEvent.click(screen.getByRole('button', { name: 'Save search' }));

      await screen.findByText('Saved "Frontend in Munich".');
      expect(requests[0]?.operation).toBe('CreateSavedSearch');
    });
  });
});
