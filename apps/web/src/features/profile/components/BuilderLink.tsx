import Link from 'next/link';
import { useTranslations } from 'next-intl';

/**
 * Where the master resume text used to be: it is now edited section by section in the Resume
 * builder, the one place for it. Shows how much is saved, so you can tell the upload worked.
 */
export function BuilderLink({ text }: { text: string }) {
  const t = useTranslations('Profile.resume');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{t('builderTitle')}</p>
        <p className="text-sm text-slate-600">
          {words ? t('builderWords', { count: words }) : t('builderEmpty')}
        </p>
      </div>
      <Link
        href="/resume"
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        {t('builderOpen')}
      </Link>
    </div>
  );
}
