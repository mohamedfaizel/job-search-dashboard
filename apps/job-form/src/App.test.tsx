import { render, screen } from '@testing-library/react';
import App from './App';

describe('Job form', () => {
  it('renders its heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /add a job/i })).toBeInTheDocument();
  });
});
