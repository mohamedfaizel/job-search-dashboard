import { act, render, screen } from '@testing-library/react';
import { AutoHide } from './AutoHide';

describe('AutoHide', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the note, then hides it by itself', () => {
    vi.useFakeTimers();
    render(
      <AutoHide ms={4000}>
        <p>Saved</p>
      </AutoHide>,
    );
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });
});
