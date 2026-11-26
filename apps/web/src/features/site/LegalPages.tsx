import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { LEGAL } from '@/lib/legal';
import { LegalLinks } from './LegalLinks';
import { WRAP } from './SiteChrome';

/*
 * The Impressum and the privacy policy: plain text pages in the site's style. The words live in
 * messages (Site.legal), the name, email and postal address in lib/legal.ts.
 */

interface Section {
  title: string;
  intro?: string;
  items: Record<string, string>;
}

const withEmail = (text: string) => text.replaceAll('{email}', LEGAL.email);

/** Name, postal address (or the "missing" note) and email: the same block on both pages. */
function Contact() {
  const t = useTranslations('Site.legal');
  return (
    <address className="mt-3 leading-7 not-italic">
      <span className="block font-semibold">{LEGAL.name}</span>
      {LEGAL.address.length > 0 ? (
        LEGAL.address.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))
      ) : (
        <span
          role="note"
          className="my-1 block rounded border-2 border-dashed border-red-600 bg-red-50 px-3 py-1 text-sm font-semibold text-red-800"
        >
          {t('addressMissing')}
        </span>
      )}
      <span className="block">
        {t('impressumPage.emailLabel')}:{' '}
        <a href={`mailto:${LEGAL.email}`} className="text-brand-800 underline">
          {LEGAL.email}
        </a>
      </span>
    </address>
  );
}

function LegalFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className={`${WRAP} max-w-3xl py-12`}>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {children}
      <LegalLinks className="mt-12 border-t border-slate-200 pt-4" />
    </article>
  );
}

const H2 = 'mt-8 text-xl font-bold';

export function ImpressumContent() {
  const t = useTranslations('Site.legal.impressumPage');
  return (
    <LegalFrame title={t('title')}>
      <p className="mt-2 text-slate-600">{t('intro')}</p>
      <h2 className={H2}>{t('providerLabel')}</h2>
      <Contact />
      <h2 className={H2}>{t('responsibleLabel')}</h2>
      <p className="mt-3">{LEGAL.name}</p>
      <p className="mt-3 text-slate-700">{t('about')}</p>
      <h2 className={H2}>{t('linksTitle')}</h2>
      <p className="mt-3 text-slate-700">{t('links')}</p>
    </LegalFrame>
  );
}

export function PrivacyContent() {
  const t = useTranslations('Site.legal');
  const sections = Object.values(t.raw('privacyPage.sections') as Record<string, Section>);
  return (
    <LegalFrame title={t('privacyPage.title')}>
      <p className="mt-2 text-sm text-slate-500">{t('updated', { date: LEGAL.updated })}</p>
      <p className="mt-4 max-w-prose text-lg text-slate-700">{t('privacyPage.intro')}</p>
      <h2 className={H2}>{t('privacyPage.controllerTitle')}</h2>
      <p className="mt-3 text-slate-700">{t('privacyPage.controller')}</p>
      <Contact />
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className={H2}>{section.title}</h2>
          {section.intro && <p className="mt-3 text-slate-700">{section.intro}</p>}
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-slate-700 marker:text-brand-600">
            {Object.values(section.items).map((item) => (
              <li key={item}>{withEmail(item)}</li>
            ))}
          </ul>
        </section>
      ))}
    </LegalFrame>
  );
}
