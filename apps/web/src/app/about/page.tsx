import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AboutPage } from '@/features/site/AboutPage';
import { SESSION_COOKIE } from '@/proxy';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Site.about');
  return { title: t('metaTitle') };
}

/** About us: open to everyone. The header shows Log in / Sign up, or My Jobs when logged in. */
export default async function About() {
  const loggedIn = (await cookies()).has(SESSION_COOKIE);
  return <AboutPage loggedIn={loggedIn} />;
}
