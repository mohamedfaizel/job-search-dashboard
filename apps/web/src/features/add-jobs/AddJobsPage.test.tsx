import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddJobsPage as App } from './AddJobsPage';
import { renderWithData } from './test/render';
import { session } from './test/server';

describe('App tabs', () => {
  it('opens on the import form with your saved searches beside it', async () => {
    renderWithData(<App />);

    expect(await screen.findByRole('tab', { name: 'Import jobs' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(await screen.findByRole('heading', { name: 'Saved searches (1)' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Import from JobHunter' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Add a job by hand' }));

    expect(screen.getByRole('heading', { name: 'Add a job by hand' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Saved searches (1)' })).not.toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    renderWithData(<App />);
    const imports = await screen.findByRole('tab', { name: 'Import jobs' });

    imports.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Add a job by hand' })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Add a job by hand' })).toBeVisible();

    await userEvent.keyboard('{ArrowRight}');
    expect(imports).toHaveFocus();
  });

  it('keeps what you typed when you switch away and back', async () => {
    renderWithData(<App />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Add a job by hand' }));
    await userEvent.type(screen.getByRole('textbox', { name: /^Job title/ }), 'Frontend engineer');

    await userEvent.click(screen.getByRole('tab', { name: 'Import jobs' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Add a job by hand' }));

    expect(screen.getByRole('textbox', { name: /^Job title/ })).toHaveValue('Frontend engineer');
  });

  it('fills the form beside the list when you edit a saved search', async () => {
    renderWithData(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Frontend in Berlin' }));

    expect(screen.getByLabelText(/^Save as/)).toHaveValue('Frontend in Berlin');
    expect(screen.getByText('In the form')).toBeInTheDocument();
  });

  it('shows the import history under both tabs', async () => {
    renderWithData(<App />);

    for (const name of ['Import jobs', 'Add a job by hand']) {
      await userEvent.click(await screen.findByRole('tab', { name }));
      expect(screen.getByRole('heading', { name: 'Import history' })).toBeVisible();
    }
  });

  it('lets a regular user add jobs too, with their own token', async () => {
    session.user = { ...session.user, role: 'USER' };
    renderWithData(<App />);

    expect(await screen.findByText(/use the token in your Settings/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.getAllByRole('tab').length).toBeGreaterThan(0);
  });
});
