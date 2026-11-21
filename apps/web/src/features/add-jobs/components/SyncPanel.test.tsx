import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { renderWithData } from '../test/render';
import { api, requests, SAVED, server } from '../test/server';
import { SyncPanel } from './SyncPanel';

describe('SyncPanel', () => {
  it('starts on the Arbeitsagentur when you have no JobHunter token yet, and says why', async () => {
    server.use(api.query('MyApiKeys', () => HttpResponse.json({ data: { myApiKeys: [] } })));
    renderWithData(<SyncPanel />);

    await vi.waitFor(() => {
      expect(screen.getByRole('radio', { name: /Arbeitsagentur/ })).toBeChecked();
    });
    expect(screen.getByText(/no JobHunter token yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Settings › API keys/ })).toHaveAttribute(
      'href',
      '/settings',
    );

    // Picking JobHunter anyway says it needs the token first.
    await userEvent.click(screen.getByRole('radio', { name: /^JobHunter/ }));
    expect(screen.getByText('JobHunter needs your own token first.')).toBeInTheDocument();
  });

  it('starts on JobHunter when your token is saved', async () => {
    renderWithData(<SyncPanel />);
    await screen.findByRole('button', { name: 'Fill from my profile' });
    expect(screen.getByRole('radio', { name: /^JobHunter/ })).toBeChecked();
    expect(screen.queryByText(/no JobHunter token yet/)).not.toBeInTheDocument();
  });

  it('fills the search from the profile, keeping fields the profile leaves empty', async () => {
    renderWithData(<SyncPanel />);

    await userEvent.click(await screen.findByRole('button', { name: 'Fill from my profile' }));

    expect(screen.getByLabelText(/^job titles/i)).toHaveValue('Frontend Engineer, React Developer');
    expect(screen.getByLabelText(/^cities or regions/i)).toHaveValue('Berlin');
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
      'Used 20 credits (5 jobs already paid this month, so no charge), 741 left.',
    );
    expect(requests[0]?.variables).toEqual({
      input: {
        titles: ['frontend'],
        skills: ['react'],
        countryCodes: ['DE'],
        maxAgeDays: 1,
        pageSize: 25,
        maxPages: 2,
        onlyNew: true,
      },
    });
  });

  it('sends cities or regions', async () => {
    renderWithData(<SyncPanel />);
    await userEvent.type(screen.getByLabelText(/^cities or regions/i), 'Berlin, Bavaria');
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
    const onlyNew = screen.getByRole('checkbox', { name: 'New since last import' });
    expect(onlyNew).toBeChecked();

    await userEvent.click(onlyNew);
    await userEvent.click(screen.getByRole('button', { name: /^import/i }));

    const status = await screen.findByRole('status');
    expect(status).not.toHaveTextContent('Looked for jobs found since');
    expect(requests[0]?.variables).toMatchObject({ input: { onlyNew: false } });
  });

  it('needs at least one job title', async () => {
    renderWithData(<SyncPanel />);
    await userEvent.clear(screen.getByLabelText(/^job titles/i));
    await userEvent.click(screen.getByRole('button', { name: /^import/i }));

    expect(await screen.findByText('Enter at least one job title')).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('folds the page settings away and opens them on a mistake', async () => {
    renderWithData(<SyncPanel />);
    const fold = screen.getByText('Page settings').closest('details');
    expect(fold).not.toHaveAttribute('open');
    expect(fold).toHaveTextContent('No. of days: 1 · 25 per page · 1 page');

    await userEvent.click(screen.getByText('Page settings'));
    const pageSize = screen.getByLabelText('Jobs per page');
    // The plan limit is plain helper text under the fields, not a tooltip that covers them.
    expect(pageSize).toHaveAccessibleDescription('Your JobHunter plan may allow at most 25');
    expect(fold?.querySelector('[role="tooltip"]')).toBeNull();
    await userEvent.clear(pageSize);
    await userEvent.type(pageSize, '0');
    await userEvent.click(screen.getByText('Page settings'));
    expect(fold).not.toHaveAttribute('open');

    await userEvent.click(screen.getByRole('button', { name: /^import/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(fold).toHaveAttribute('open');
    expect(requests).toHaveLength(0);
  });

  it('sends the extra filters from the chips', async () => {
    renderWithData(<SyncPanel />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'English' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Skip fluent-German ads' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Remote only' }));
    await userEvent.type(screen.getByLabelText('Skip titles with'), 'Werkstudent, Praktikum');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Full-time' }));
    await userEvent.type(screen.getByLabelText('Min salary (€ a year)'), '60000');

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

  it('shows the filters a loaded search uses as ticked chips', () => {
    renderWithData(<SyncPanel loaded={{ ...SAVED, remoteOnly: true }} />);
    expect(screen.getByRole('checkbox', { name: 'Remote only' })).toBeChecked();
  });

  describe('saving the search', () => {
    it('saves the form as a named search', async () => {
      renderWithData(<SyncPanel />);
      await userEvent.type(screen.getByLabelText(/^cities or regions/i), 'Berlin');
      await userEvent.type(screen.getByLabelText('Save as'), 'Frontend in Berlin');

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
            maxAgeDays: 1,
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
      expect(screen.getByLabelText(/^cities or regions/i)).toHaveValue('Berlin');
      expect(screen.getByLabelText('Max pages')).toHaveValue('2');

      await userEvent.click(screen.getByRole('button', { name: 'Update saved search' }));

      await screen.findByText('Saved "Frontend in Berlin".');
      expect(requests[0]).toMatchObject({ operation: 'UpdateSavedSearch', variables: { id: 1 } });
    });

    it('saves a renamed copy as a new search', async () => {
      renderWithData(<SyncPanel loaded={SAVED} />);
      const name = screen.getByLabelText('Save as');
      await userEvent.clear(name);
      await userEvent.type(name, 'Frontend in Munich');

      await userEvent.click(screen.getByRole('button', { name: 'Save search' }));

      await screen.findByText('Saved "Frontend in Munich".');
      expect(requests[0]?.operation).toBe('CreateSavedSearch');
    });
  });

  it('imports from the free German board, hiding filters it ignores', async () => {
    renderWithData(<SyncPanel />);
    expect(screen.getByRole('radio', { name: /JobHunter/ })).toBeChecked();
    await userEvent.type(screen.getByLabelText(/^cities or regions/i), 'Berlin');

    await userEvent.click(screen.getByRole('radio', { name: /Arbeitsagentur/ }));

    expect(screen.getByRole('heading', { name: 'Import from Arbeitsagentur' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^skills/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Countries' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'English' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Min salary (€ a year)')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Contract' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Part-time' })).toBeInTheDocument();

    // No credit estimate on the button.
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(await screen.findByRole('status')).toHaveTextContent('No credits used.');
    expect(requests[0]?.variables).toEqual({
      input: {
        source: 'ARBEITSAGENTUR',
        titles: ['frontend'],
        locations: ['Berlin'],
        maxAgeDays: 1,
        pageSize: 25,
        maxPages: 1,
        onlyNew: true,
      },
    });
  });

  it('opens a saved free search on the free board', () => {
    renderWithData(<SyncPanel loaded={{ ...SAVED, source: 'ARBEITSAGENTUR' }} />);
    expect(screen.getByRole('radio', { name: /Arbeitsagentur/ })).toBeChecked();
  });

  describe('company career pages', () => {
    const pick = () => userEvent.click(screen.getByRole('radio', { name: /Company career pages/ }));

    it('asks for the companies, hides what does not apply and sends them', async () => {
      renderWithData(<SyncPanel />);
      await pick();

      expect(
        screen.getByRole('heading', { name: 'Import from company career pages' }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(/^skills/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'Countries' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Jobs per page')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Max pages')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/new since last import/i)).not.toBeInTheDocument();

      await userEvent.type(
        screen.getByRole('textbox', { name: /^company career pages/i }),
        'greenhouse:stripe, https://jobs.lever.co/netflix  ashby:ramp',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Import' }));

      expect(await screen.findByRole('status')).toHaveTextContent('No credits used.');
      expect(requests[0]?.variables).toEqual({
        input: {
          source: 'COMPANY_BOARDS',
          boards: ['greenhouse:stripe', 'https://jobs.lever.co/netflix', 'ashby:ramp'],
          titles: ['frontend'],
          maxAgeDays: 1,
          pageSize: 25,
          maxPages: 1,
          onlyNew: true,
        },
      });
    });

    it('picks companies from the list into the same box, and clears the error', async () => {
      renderWithData(<SyncPanel />);
      await pick();
      await userEvent.click(screen.getByRole('button', { name: 'Import' }));
      expect(
        await screen.findByText('Add at least one company board, like greenhouse:stripe'),
      ).toBeInTheDocument();

      const box = screen.getByRole('textbox', { name: /^company career pages/i });
      await userEvent.type(box, 'lever:acme');
      await userEvent.click(screen.getByRole('button', { name: /^Pick from \d+ companies$/ }));
      await userEvent.click(screen.getByRole('checkbox', { name: /Stripe/ }));
      expect(box).toHaveValue('lever:acme, greenhouse:stripe');
      expect(
        screen.queryByText('Add at least one company board, like greenhouse:stripe'),
      ).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('checkbox', { name: /Stripe/ }));
      expect(box).toHaveValue('lever:acme');
    });

    it('needs at least one company', async () => {
      renderWithData(<SyncPanel />);
      await pick();

      await userEvent.click(screen.getByRole('button', { name: 'Import' }));

      expect(
        await screen.findByText('Add at least one company board, like greenhouse:stripe'),
      ).toBeInTheDocument();
      expect(requests).toHaveLength(0);
    });

    it('lists the boards that could not be read', async () => {
      server.use(
        api.mutation('SyncJobs', () =>
          HttpResponse.json({
            data: {
              syncJobs: {
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
                warnings: ['greenhouse:gone: 404 Not Found'],
              },
            },
          }),
        ),
      );
      renderWithData(<SyncPanel />);
      await pick();
      await userEvent.type(
        screen.getByRole('textbox', { name: /^company career pages/i }),
        'greenhouse:gone',
      );

      await userEvent.click(screen.getByRole('button', { name: 'Import' }));

      const status = await screen.findByRole('status');
      expect(status).toHaveTextContent('Some things to know:');
      expect(status).toHaveTextContent(
        'Gone (Greenhouse): no career page found under this name. Check the spelling.',
      );
    });

    it('opens a saved search with its companies', () => {
      renderWithData(
        <SyncPanel loaded={{ ...SAVED, source: 'COMPANY_BOARDS', boards: ['lever:netflix'] }} />,
      );
      expect(screen.getByRole('radio', { name: /Company career pages/ })).toBeChecked();
      expect(screen.getByRole('textbox', { name: /^company career pages/i })).toHaveValue(
        'lever:netflix',
      );
    });
  });
});
