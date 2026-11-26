import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { KIT_RUN } from './operations';
import type { KitRun } from './types';

export const kitRunKey = ['kitRun'] as const;
/** How often a saved search asks for progress while its kits are being written. */
export const KIT_RUN_POLL_MS = 3000;

/** Your latest apply-kits run; asks again every few seconds while it is still writing. */
export function useKitRun() {
  return useQuery({
    queryKey: kitRunKey,
    queryFn: async () => (await graphqlClient.request<{ kitRun: KitRun | null }>(KIT_RUN)).kitRun,
    refetchInterval: (query) => (query.state.data?.running ? KIT_RUN_POLL_MS : false),
  });
}
