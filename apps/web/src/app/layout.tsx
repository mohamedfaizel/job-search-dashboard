import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/app-name';
import { Providers } from './providers';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: t('description'),
  };
}

/**
 * The root layout wraps every page: the <html> and <body>, the texts in your language and the
 * data providers. NextIntlClientProvider hands the texts to the client components.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
