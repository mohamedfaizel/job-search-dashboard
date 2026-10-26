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

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Fetched 25 jobs: 20 new, 5 updated. More are available',
    );
    expect(requests[0]?.variables).toEqual({
      input: {
        titles: ['frontend'],
        skills: ['react'],
        countryCodes: ['DE'],
        maxAgeDays: 7,
        pageSize: 25,
        maxPages: 2,
      },
    });
  });

  it('needs at least one job title', async () => {
    renderWithData(<SyncPanel />);
    await userEvent.clear(screen.getByLabelText(/job titles/i));
    await userEvent.click(screen.getByRole('button', { name: /import/i }));

    expect(await screen.findByText('Enter at least one job title')).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });
});
