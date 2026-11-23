import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AppFrame } from '@/components/AppFrame';
import { AboutContent, AboutPage } from '@/features/site/AboutPage';
import { SESSION_COOKIE } from '@/proxy';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Site.about');
  return { title: t('metaTitle') };
}

/**
 * About us: open to everyone. Logged in, it sits inside the app (the same header, with the i
 * lit up), and logging in lands here. A visitor sees the public header.
 */
export default async function About() {
  const loggedIn = (await cookies()).has(SESSION_COOKIE);
  if (!loggedIn) return <AboutPage />;
  return (
    <AppFrame>
      <AboutContent loggedIn />
    </AppFrame>
  );
}
