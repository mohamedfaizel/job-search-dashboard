import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AppFrame } from '@/components/AppFrame';
import { ImpressumContent } from '@/features/site/LegalPages';
import { SiteHeader } from '@/features/site/SiteChrome';
import { SESSION_COOKIE } from '@/proxy';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Site.legal.impressumPage');
  return { title: t('metaTitle') };
}

/** Open to everyone, like About us: inside the app when logged in, with the public header if not. */
export default async function Impressum() {
  const loggedIn = (await cookies()).has(SESSION_COOKIE);
  if (loggedIn) {
    return (
      <AppFrame>
        <ImpressumContent />
      </AppFrame>
    );
  }
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader loggedIn={false} />
      <main id="main">
        <ImpressumContent />
      </main>
    </div>
  );
}
