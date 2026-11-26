import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphqlClient } from './client';
import { useUndoMailAuto } from './notifications';
import {
  useKitRun,
  useSetBriefing,
  useSetMailAutoStatus,
  useSetNightlyKits,
  useSetWeeklyReport,
  useWriteKitsNow,
} from './settings';

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
}

describe('automation settings hooks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves nightly kits and reloads the profile', async () => {
    const request = vi.spyOn(graphqlClient, 'request').mockResolvedValue({ setNightlyKits: true });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSetNightlyKits(), { wrapper });
    const input = { on: true, perNight: 3, at: '22:30', fitMin: 75, target: 90 };
    await expect(act(() => result.current.mutateAsync(input))).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith(expect.stringContaining('setNightlyKits'), { input });
    expect(invalidate).toHaveBeenCalled();
  });

  it('starts writing kits now and says how many', async () => {
    vi.spyOn(graphqlClient, 'request').mockResolvedValue({ writeKitsNow: 2 });
    const { wrapper } = setup();
    const { result } = renderHook(() => useWriteKitsNow(), { wrapper });
    await expect(act(() => result.current.mutateAsync())).resolves.toBe(2);
  });

  it('saves the morning briefing and reloads the profile', async () => {
    const request = vi.spyOn(graphqlClient, 'request').mockResolvedValue({ setBriefing: true });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSetBriefing(), { wrapper });
    await expect(act(() => result.current.mutateAsync({ on: false, at: '08:00' }))).resolves.toBe(
      true,
    );
    expect(request).toHaveBeenCalledWith(expect.stringContaining('setBriefing'), {
      input: { on: false, at: '08:00' },
    });
    expect(invalidate).toHaveBeenCalled();
  });

  it('turns the weekly report off and reloads the profile', async () => {
    const request = vi.spyOn(graphqlClient, 'request').mockResolvedValue({ setWeeklyReport: true });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSetWeeklyReport(), { wrapper });
    await expect(act(() => result.current.mutateAsync(false))).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith(expect.stringContaining('setWeeklyReport'), { on: false });
    expect(invalidate).toHaveBeenCalled();
  });

  it('turns Gmail moving jobs by itself on or off, and undoes a move', async () => {
    const request = vi
      .spyOn(graphqlClient, 'request')
      .mockResolvedValueOnce({ setMailAutoStatus: false })
      .mockResolvedValueOnce({ undoMailAuto: true });
    const { invalidate, wrapper } = setup();
    const toggle = renderHook(() => useSetMailAutoStatus(), { wrapper });
    await expect(act(() => toggle.result.current.mutateAsync(false))).resolves.toBe(false);
    const undo = renderHook(() => useUndoMailAuto(), { wrapper });
    await expect(act(() => undo.result.current.mutateAsync(7))).resolves.toBe(true);
    expect(request).toHaveBeenNthCalledWith(1, expect.stringContaining('setMailAutoStatus'), {
      on: false,
    });
    expect(request).toHaveBeenNthCalledWith(2, expect.stringContaining('undoMailAuto'), {
      notificationId: 7,
    });
    expect(invalidate).toHaveBeenCalled();
  });

  it('reads the latest kits run', async () => {
    const run = { running: false, total: 2, done: 2, written: 2, failed: 0, reason: null };
    const request = vi.spyOn(graphqlClient, 'request').mockResolvedValue({ kitRun: run });
    const { wrapper } = setup();
    const { result } = renderHook(() => useKitRun(), { wrapper });
    await waitFor(() => {
      expect(result.current.data).toEqual(run);
    });
    expect(request).toHaveBeenCalledWith(expect.stringContaining('kitRun'));
  });
});
