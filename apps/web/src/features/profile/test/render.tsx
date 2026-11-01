import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { Locale } from '@/i18n/config';
import { Intl } from '@/test/intl';

/** Renders with a fresh store and query cache, so tests don't leak into each other. */
export function renderWithData(ui: ReactElement, locale: Locale = 'en') {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  return render(
    <Intl locale={locale}>
      <DataProvider store={makeStore()} queryClient={queryClient}>
        {ui}
      </DataProvider>
    </Intl>,
  );
}
