import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MessageOpener } from '@/features/messages/MessageOpener';
import { MAKER } from '@/lib/maker';

const LINK = 'inline-flex items-center gap-2 font-semibold text-black hover:underline';

/**
 * "Made by Mohamed Faizel" with the round photo, and a link for questions and ideas. The same
 * line closes the public pages and every page inside the app. Logged in, the link opens the
 * message window; a visitor goes to the contact part of About us.
 */
export function MakerLine({ loggedIn = false }: { loggedIn?: boolean }) {
  const t = useTranslations('Site.footer');
  const label = (
    <>
      <img src={MAKER.face} alt="" width={24} height={24} className="h-6 w-6 rounded-full" />
      {t('queries')} ›
    </>
  );
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
      <span>{t('madeBy')}</span>
      {loggedIn ? (
        <MessageOpener loggedIn className={LINK}>
          {label}
        </MessageOpener>
      ) : (
        <Link href="/about#contact" className={LINK}>
          {label}
        </Link>
      )}
    </p>
  );
}
