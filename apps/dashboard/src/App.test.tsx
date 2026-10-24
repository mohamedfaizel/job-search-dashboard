import { render, screen } from '@testing-library/react';
import App from './App';
import { JOB_COLUMNS } from './columns';

describe('Dashboard', () => {
  it('shows every column from the reference design', () => {
    render(<App />);
    for (const column of JOB_COLUMNS) {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument();
    }
  });

  it('shows an empty state before data is loaded', () => {
    render(<App />);
    expect(screen.getByText(/no jobs yet/i)).toBeInTheDocument();
  });
});
