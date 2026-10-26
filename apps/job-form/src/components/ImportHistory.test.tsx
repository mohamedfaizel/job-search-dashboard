import { screen, within } from '@testing-library/react';
import { renderWithData } from '../test/render';
import { ImportHistory } from './ImportHistory';

describe('ImportHistory', () => {
  it('lists past imports with their counts', async () => {
    renderWithData(<ImportHistory />);

    const table = await screen.findByRole('table', { name: 'The last 20 imports from JobsPipe' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('Frontend in Berlin: frontend · react · DE · Berlin');
    const cells = within(rows[1]!)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    // New, already saved, credits, pages.
    expect(cells.slice(2)).toEqual(['20', '5', '20', 'All fetched']);
    expect(rows[2]).toHaveTextContent('backend');
    expect(rows[2]).toHaveTextContent('More left');
    // Only the run the scheduler started gets the tag.
    expect(within(rows[2]!).getByText('Scheduled')).toBeInTheDocument();
    expect(within(rows[1]!).queryByText('Scheduled')).not.toBeInTheDocument();
  });
});
