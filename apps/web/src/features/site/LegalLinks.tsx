import Link from 'next/link';
import { useTranslations } from 'next-intl';

/** "Impressum · Privacy policy": the small links at the end of About us, login and sign-up. */
export function LegalLinks({ className = '' }: { className?: string }) {
  const t = useTranslations('Site.legal');
  return (
    <nav aria-label={t('linksLabel')} className={`text-sm text-slate-500 ${className}`}>
      <Link href="/impressum" className="hover:text-black hover:underline">
        {t('impressum')}
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href="/privacy" className="hover:text-black hover:underline">
        {t('privacy')}
      </Link>
    </nav>
  );
}
