import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/ServiceWorker';
import { APP_NAME } from '@/lib/app-name';
import { Providers } from './providers';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: t('description'),
    // On an iPhone "Add to Home Screen" uses these: its own window and a short name.
    appleWebApp: { capable: true, title: 'Job Hunter', statusBarStyle: 'black' },
  };
}

/** The black of the header bar colours the phone's status bar and the installed app's title bar. */
export const viewport: Viewport = { themeColor: '#0b0b0b' };

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
          <ServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
