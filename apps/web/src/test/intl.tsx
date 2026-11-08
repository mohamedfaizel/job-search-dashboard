import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { TIME_ZONE } from '@/i18n/config';
import { withAiName } from '@/lib/ai-chat';
import de from '../../messages/de.json';
import en from '../../messages/en.json';

/**
 * Gives components their texts in a test, as the root layout does in the app. The app frame
 * fills {ai} with the chat's name; here it is Claude unless a test picks another (`ai`).
 */
export function Intl({
  locale = 'en',
  ai = 'Claude',
  children,
}: {
  locale?: Locale;
  ai?: string;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={withAiName(locale === 'de' ? de : en, ai)}
      timeZone={TIME_ZONE}
      // A missing text fails the test, instead of only logging an error as the app does.
      onError={(error) => {
        throw error;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
