import { createQueryClient, DataProvider, makeStore, useMe } from '@jobsearch/data';
import { getLocales } from 'expo-localization';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { IntlProvider } from 'use-intl';
import { messages, pickLocale } from '../i18n/messages';
import './api';

/** The app in your account's language, or your phone's before you log in. */
function WithLanguage({ children }: { children: ReactNode }) {
  const me = useMe();
  const locale = pickLocale(me.data?.locale, getLocales()[0].languageCode);
  return (
    <IntlProvider locale={locale} messages={messages[locale]} timeZone="Europe/Berlin">
      {children}
    </IntlProvider>
  );
}

/** Data (the same hooks and cache as the website) and language for every screen. */
export function Providers({
  children,
  queryClient,
}: {
  children: ReactNode;
  /** Tests pass their own, so nothing is cached between them. */
  queryClient?: ReturnType<typeof createQueryClient>;
}) {
  const [store] = useState(makeStore);
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <DataProvider store={store} queryClient={client}>
      <WithLanguage>{children}</WithLanguage>
    </DataProvider>
  );
}
