'use client';

import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import type { ReactNode } from 'react';
import { useState } from 'react';

/**
 * The Redux store and the query cache live in the browser. useState makes one of each per
 * browser tab, so on the server two visitors never share a cache.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);
  const [queryClient] = useState(createQueryClient);
  return (
    <DataProvider store={store} queryClient={queryClient}>
      {children}
    </DataProvider>
  );
}
