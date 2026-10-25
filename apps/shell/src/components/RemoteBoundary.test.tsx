import { render, screen } from '@testing-library/react';
import { RemoteBoundary } from './RemoteBoundary';

function Broken(): never {
  throw new Error('remote is down');
}

describe('RemoteBoundary', () => {
  it('renders the remote when it loads', () => {
    render(
      <RemoteBoundary name="dashboard">
        <p>hello from the remote</p>
      </RemoteBoundary>,
    );
    expect(screen.getByText('hello from the remote')).toBeInTheDocument();
  });

  it('shows a friendly error when the remote fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <RemoteBoundary name="dashboard">
        <Broken />
      </RemoteBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the dashboard.');
  });
});
