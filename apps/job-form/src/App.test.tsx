import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { renderWithData } from './test/render';

// App brings its own DataProvider; the outer one from renderWithData sets up the MSW-backed client.
describe('App tabs', () => {
  it('opens on saved searches and switches tabs on click', async () => {
    renderWithData(<App />);

    expect(await screen.findByRole('tab', { name: 'Saved searches (1)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('heading', { name: 'Saved searches' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Add a job by hand' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Add a job by hand' }));

    expect(screen.getByRole('heading', { name: 'Add a job by hand' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Saved searches' })).not.toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    renderWithData(<App />);
    const saved = await screen.findByRole('tab', { name: /^Saved searches/ });

    saved.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Import from JobsPipe' })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Import from JobsPipe' })).toBeVisible();

    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Add a job by hand' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.keyboard('{ArrowRight}');
    expect(saved).toHaveFocus();
  });

  it('keeps what you typed when you switch away and back', async () => {
    renderWithData(<App />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Add a job by hand' }));
    await userEvent.type(screen.getByRole('textbox', { name: /^Job title/ }), 'Frontend engineer');

    await userEvent.click(screen.getByRole('tab', { name: /^Saved searches/ }));
    await userEvent.click(screen.getByRole('tab', { name: 'Add a job by hand' }));

    expect(screen.getByRole('textbox', { name: /^Job title/ })).toHaveValue('Frontend engineer');
  });

  it('opens the import tab with the search filled in when you edit a saved search', async () => {
    renderWithData(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('tab', { name: 'Import from JobsPipe' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText(/^Save this search as/)).toHaveValue('Frontend in Berlin');
  });

  it('shows the import history under every tab', async () => {
    renderWithData(<App />);

    for (const name of [/^Saved searches/, 'Import from JobsPipe', 'Add a job by hand']) {
      await userEvent.click(await screen.findByRole('tab', { name }));
      expect(screen.getByRole('heading', { name: 'Import history' })).toBeVisible();
    }
  });
});
