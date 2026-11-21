import { act, render, screen } from '@testing-library/react';
import { Intl } from '../test/intl';
import { AUTO_RETRY_MS, ServerDown } from './ServerDown';

describe('ServerDown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tries again by itself every 30 seconds', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    render(
      <Intl locale="en">
        <ServerDown onRetry={onRetry} retrying={false} />
      </Intl>,
    );
    act(() => {
      vi.advanceTimersByTime(AUTO_RETRY_MS - 1);
    });
    expect(onRetry).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(AUTO_RETRY_MS);
    });
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('shows Trying… while it asks again', () => {
    render(
      <Intl locale="en">
        <ServerDown onRetry={vi.fn()} retrying />
      </Intl>,
    );
    expect(screen.getByRole('button', { name: 'Trying…' })).toBeDisabled();
  });
});
