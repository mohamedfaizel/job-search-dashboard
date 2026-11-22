import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appSettingsKey } from './admin';
import { graphqlClient } from './client';
import { notificationsKey } from './notifications';
import {
  ADD_POOL_KEYS,
  APPROVE_KEY_REQUEST,
  CANCEL_POOL_KEY_REQUEST,
  DENY_KEY_REQUEST,
  GIVE_POOL_KEY_BACK,
  KEY_POOL,
  MY_POOL_KEY,
  REMOVE_POOL_KEY,
  REQUEST_POOL_KEY,
  TAKE_BACK_POOL_KEY,
} from './operations';
import { apiKeysKey } from './settings';
import type { AddPoolKeysResult, KeyPool, MyPoolKey } from './types';

export const myPoolKeyKey = ['settings', 'poolKey'] as const;
export const keyPoolKey = ['admin', 'keyPool'] as const;

/** Settings › API keys: where your token request stands. */
export function useMyPoolKey(enabled = true) {
  return useQuery({
    queryKey: myPoolKeyKey,
    enabled,
    queryFn: async () =>
      (await graphqlClient.request<{ myPoolKey: MyPoolKey }>(MY_POOL_KEY)).myPoolKey,
  });
}

function useMine(document: string, field: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await graphqlClient.request<Record<string, MyPoolKey>>(document))[field] as MyPoolKey,
    onSuccess: async (state) => {
      queryClient.setQueryData(myPoolKeyKey, state);
      await queryClient.invalidateQueries({ queryKey: apiKeysKey });
      await queryClient.invalidateQueries({ queryKey: notificationsKey });
    },
  });
}

/** Asks the admins for a token. A first request may be approved at once. */
export const useRequestPoolKey = () => useMine(REQUEST_POOL_KEY, 'requestPoolKey');
export const useCancelPoolKeyRequest = () =>
  useMine(CANCEL_POOL_KEY_REQUEST, 'cancelPoolKeyRequest');
export const useGivePoolKeyBack = () => useMine(GIVE_POOL_KEY_BACK, 'givePoolKeyBack');

/** Admin › Key pool: counts, keys by number and waiting requests. */
export function useKeyPool(enabled = true) {
  return useQuery({
    queryKey: keyPoolKey,
    enabled,
    queryFn: async () => (await graphqlClient.request<{ keyPool: KeyPool }>(KEY_POOL)).keyPool,
  });
}

function usePoolChange<Input>(document: string, field: string, vars: (input: Input) => object) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Input) =>
      (await graphqlClient.request<Record<string, KeyPool>>(document, vars(input)))[
        field
      ] as KeyPool,
    onSuccess: async (pool) => {
      queryClient.setQueryData(keyPoolKey, pool);
      await queryClient.invalidateQueries({ queryKey: appSettingsKey });
    },
  });
}

export const useApproveKeyRequest = () =>
  usePoolChange(APPROVE_KEY_REQUEST, 'approveKeyRequest', (id: number) => ({ id }));
export const useDenyKeyRequest = () =>
  usePoolChange(
    DENY_KEY_REQUEST,
    'denyKeyRequest',
    (input: { id: number; note?: string | undefined }) => ({
      input,
    }),
  );
export const useTakeBackPoolKey = () =>
  usePoolChange(
    TAKE_BACK_POOL_KEY,
    'takeBackPoolKey',
    (input: { id: number; passOn: boolean }) => input,
  );
export const useRemovePoolKey = () =>
  usePoolChange(REMOVE_POOL_KEY, 'removePoolKey', (id: number) => ({ id }));

/** Adds pasted tokens to the pool. */
export function useAddPoolKeys() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keys: string; note: string }) =>
      (await graphqlClient.request<{ addPoolKeys: AddPoolKeysResult }>(ADD_POOL_KEYS, { input }))
        .addPoolKeys,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keyPoolKey }),
  });
}
