import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import de from '../../messages/de.json';
import en from '../../messages/en.json';

/** Gives components their texts in a test, as the root layout does in the app. */
export function Intl({ locale = 'en', children }: { locale?: Locale; children: ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'de' ? de : en}>
      {children}
    </NextIntlClientProvider>
  );
}
