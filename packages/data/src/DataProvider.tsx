import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { meKey } from './api/auth';
import { isUnauthenticated } from './api/client';
import type { AppStore } from './store/store';

export function createQueryClient(): QueryClient {
  // When any request says "log in first" (the session expired), forget the user: the app
  // then shows the login page instead of a screen full of errors.
  const onError = (error: unknown) => {
    if (isUnauthenticated(error)) client.setQueryData(meKey, null);
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retrying won't log anyone in.
        retry: (failures, error) => !isUnauthenticated(error) && failures < 1,
        refetchOnWindowFocus: false,
      },
    },
  });
  return client;
}

interface Props {
  children: ReactNode;
  /** Made once per page (or per test or story) with makeStore() and createQueryClient(). */
  store: AppStore;
  queryClient: QueryClient;
}

export function DataProvider({ children, store, queryClient }: Props) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}
