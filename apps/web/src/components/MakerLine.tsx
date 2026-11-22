import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MAKER } from '@/lib/maker';

/**
 * "Made by Mohamed Faizel" with the round photo, and a link for questions and ideas. The same
 * line closes the public pages and every page inside the app.
 */
export function MakerLine() {
  const t = useTranslations('Site.footer');
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
      <span>{t('madeBy')}</span>
      <Link
        href="/about#contact"
        className="inline-flex items-center gap-2 font-semibold text-black hover:underline"
      >
        <img src={MAKER.face} alt="" width={24} height={24} className="h-6 w-6 rounded-full" />
        {t('queries')} ›
      </Link>
    </p>
  );
}
