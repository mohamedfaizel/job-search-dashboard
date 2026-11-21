'use client';

import { useCoverLetterTemplate, useResumeBuild } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { useErrorText } from '../../i18n/useErrorText';
import { TemplatePanel } from './components/LetterPanel';
import { PdfPreview } from './components/PdfPreview';
import { ResumeSwitcher } from './components/ResumeSwitcher';

/**
 * Your cover letter template in one language (/resume?letter=en): the letter on the left, its
 * PDF on the right. A job's Cover letter step can start from it.
 */
export function LetterTemplatePage({ language }: { language: string }) {
  const t = useTranslations('Resume');
  const errorText = useErrorText();
  // Your resume in this language knows which languages you have resumes (and templates) in.
  const build = useResumeBuild(language);
  const [version, setVersion] = useState('first');
  const saved = useCallback(() => {
    setVersion(`template-${String(Date.now())}`);
  }, []);

  if (build.isPending) return <p className="text-sm text-slate-600">{t('loading')}</p>;
  if (build.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(build.error)}
      </p>
    );
  }
  const lang = build.data.language;
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="space-y-1">
        <h1 className="sr-only">{t('templatePage.heading')}</h1>
        <ResumeSwitcher
          languages={build.data.languages}
          language={lang}
          letter
          onLanguage={() => undefined}
          onOpen={(href) => {
            window.location.assign(href);
          }}
        />
        <p className="text-sm text-slate-600">{t('templatePage.intro')}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <TemplatePanel key={lang} language={lang} onSaved={saved} />
        </div>
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <TemplatePreview language={lang} version={version} />
        </div>
      </div>
    </div>
  );
}

/** The template's PDF, once it has a paragraph. */
function TemplatePreview({ language, version }: { language: string; version: string }) {
  const text = useCoverLetterTemplate(language).data?.text ?? '';
  return (
    <PdfPreview
      language={language}
      version={version}
      maxPages={1}
      letter
      enabled={text.trim() !== ''}
    />
  );
}
