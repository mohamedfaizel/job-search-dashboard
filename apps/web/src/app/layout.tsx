import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Job Search', template: '%s · Job Search' },
  description: 'Track jobs, your applications and your profile.',
};

/** The root layout wraps every page: the <html> and <body>, and the data providers. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
