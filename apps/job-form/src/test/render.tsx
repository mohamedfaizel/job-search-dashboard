import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

/** Renders with a fresh store and query cache, so tests don't leak into each other. */
export function renderWithData(ui: ReactElement) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  return render(
    <DataProvider store={makeStore()} queryClient={queryClient}>
      {ui}
    </DataProvider>,
  );
}
