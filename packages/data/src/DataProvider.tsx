import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { meKey } from './api/auth';
import { isUnauthenticated } from './api/client';
import type { AppStore } from './store/store';
import { makeStore } from './store/store';

export function createQueryClient(): QueryClient {
  // When any request says "log in first" (the session expired), forget the user: the shell
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

// One store and one query cache for the whole page. Module Federation shares this package
// as a singleton, so the shell and every microfrontend see the same state and cache:
// a job added in the form shows up in the dashboard without a reload.
const sharedStore = makeStore();
const sharedQueryClient = createQueryClient();

interface Props {
  children: ReactNode;
  /** Tests and stories pass their own, so each starts from a clean slate. */
  store?: AppStore;
  queryClient?: QueryClient;
}

export function DataProvider({
  children,
  store = sharedStore,
  queryClient = sharedQueryClient,
}: Props) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}
