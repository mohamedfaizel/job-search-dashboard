import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphqlClient } from './client';
import {
  keyPoolKey,
  myPoolKeyKey,
  useAddPoolKeys,
  useApproveKeyRequest,
  useCancelPoolKeyRequest,
  useDenyKeyRequest,
  useGivePoolKeyBack,
  useKeyPool,
  useMyPoolKey,
  useRemovePoolKey,
  useRequestPoolKey,
  useTakeBackPoolKey,
} from './keyPool';

const pool = {
  free: 1,
  assigned: 0,
  empty: 0,
  limit: 500,
  autoApprove: true,
  keys: [],
  requests: [],
};
const mine = {
  state: 'APPROVED',
  limit: 500,
  used: 0,
  note: null,
  askAgainAt: null,
  poolEmpty: false,
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('Key pool hooks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads your request and the admin pool', async () => {
    vi.spyOn(graphqlClient, 'request').mockResolvedValue({ myPoolKey: mine, keyPool: pool });
    const { wrapper } = setup();
    const own = renderHook(() => useMyPoolKey(), { wrapper });
    const all = renderHook(() => useKeyPool(), { wrapper });
    await waitFor(() => {
      expect(own.result.current.data).toEqual(mine);
    });
    await waitFor(() => {
      expect(all.result.current.data).toEqual(pool);
    });
  });

  it.each([
    ['requestPoolKey', useRequestPoolKey],
    ['cancelPoolKeyRequest', useCancelPoolKeyRequest],
    ['givePoolKeyBack', useGivePoolKeyBack],
  ] as const)('%s stores the new state', async (field, hook) => {
    vi.spyOn(graphqlClient, 'request').mockResolvedValue({ [field]: mine });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => hook(), { wrapper });
    await act(() => result.current.mutateAsync());
    expect(queryClient.getQueryData(myPoolKeyKey)).toEqual(mine);
  });

  it('sends each admin change and stores the pool it answers', async () => {
    const request = vi.spyOn(graphqlClient, 'request').mockImplementation(((document: string) => {
      const field = /\{\s*(\w+)\s*\(/.exec(document)?.[1] ?? '';
      return Promise.resolve(
        field === 'addPoolKeys'
          ? { addPoolKeys: { added: 1, duplicates: 0, invalid: 0 } }
          : { [field]: pool },
      );
    }) as typeof graphqlClient.request);
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(
      () => ({
        approve: useApproveKeyRequest(),
        deny: useDenyKeyRequest(),
        takeBack: useTakeBackPoolKey(),
        remove: useRemovePoolKey(),
        add: useAddPoolKeys(),
      }),
      { wrapper },
    );
    await act(() => result.current.approve.mutateAsync(7));
    await act(() => result.current.deny.mutateAsync({ id: 7, note: 'Later' }));
    await act(() => result.current.takeBack.mutateAsync({ id: 2, passOn: true }));
    await act(() => result.current.remove.mutateAsync(1));
    await act(() => result.current.add.mutateAsync({ keys: 'jp_a', note: '' }));
    await waitFor(() => {
      expect(result.current.add.data).toEqual({ added: 1, duplicates: 0, invalid: 0 });
    });

    expect(queryClient.getQueryData(keyPoolKey)).toEqual(pool);
    expect(request.mock.calls.map((call) => (call as unknown[])[1])).toEqual([
      { id: 7 },
      { input: { id: 7, note: 'Later' } },
      { id: 2, passOn: true },
      { id: 1 },
      { input: { keys: 'jp_a', note: '' } },
    ]);
  });
});
