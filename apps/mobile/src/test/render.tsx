import { createQueryClient } from '@jobsearch/data';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Providers } from '../lib/Providers';

/**
 * Renders a screen with fresh data and language providers, as the app does. Pass a query client
 * to refetch with it from the test.
 */
export function renderApp(ui: ReactElement, queryClient = createQueryClient()) {
  return render(<Providers queryClient={queryClient}>{ui}</Providers>);
}
