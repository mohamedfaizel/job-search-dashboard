import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { KIT_RUN, WRITE_APPLY_QUEUE_KITS } from './operations';
import type { KitRun, QueueKitsInput } from './types';

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

/**
 * "Write with my key" in the Apply queue: the server writes the kits of the queued jobs with no
 * reply yet, with your own AI key. Its progress comes from useKitRun, which this starts polling.
 */
export function useWriteApplyQueueKits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: QueueKitsInput) =>
      (
        await graphqlClient.request<{ writeApplyQueueKits: KitRun }>(WRITE_APPLY_QUEUE_KITS, {
          input,
        })
      ).writeApplyQueueKits,
    onSuccess: (run) => {
      queryClient.setQueryData(kitRunKey, run);
    },
  });
}
