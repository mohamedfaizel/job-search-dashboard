import type { BuilderDoc } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { ListEditor } from './ListEditor';
import { FIELD } from './ui';

interface Props {
  doc: BuilderDoc;
  onChange: (doc: BuilderDoc, field: string | null) => void;
}

/** The top of the resume: your name, headline and contact details. Always first. */
export function HeaderCard({ doc, onChange }: Props) {
  const t = useTranslations('Resume');
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-h`}
      className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
    >
      <h2 id={`${id}-h`} className="px-1.5 text-sm font-semibold text-slate-900">
        {t('header')}
      </h2>
      <div className="grid gap-2 pl-6 sm:grid-cols-2">
        <div className="min-w-0 space-y-0.5">
          <label htmlFor={`${id}-name`} className="block text-xs font-medium text-slate-600">
            {t('name')}
          </label>
          <input
            id={`${id}-name`}
            value={doc.name}
            onChange={(event) => {
              onChange({ ...doc, name: event.target.value }, 'name');
            }}
            className={FIELD}
          />
        </div>
        <div className="min-w-0 space-y-0.5">
          <label htmlFor={`${id}-headline`} className="block text-xs font-medium text-slate-600">
            {t('headline')}
          </label>
          <input
            id={`${id}-headline`}
            value={doc.headline}
            placeholder={t('headlinePlaceholder')}
            onChange={(event) => {
              onChange({ ...doc, headline: event.target.value }, 'headline');
            }}
            className={FIELD}
          />
        </div>
      </div>
      <div className="space-y-0.5 pl-6">
        <p className="text-xs font-medium text-slate-600">{t('contact')}</p>
        <ListEditor
          scope="contact"
          items={doc.contact.length ? doc.contact : ['']}
          itemLabel={t('contactItem')}
          addLabel={t('addContact')}
          placeholder={t('contactPlaceholder')}
          onChange={(contact, field) => {
            onChange({ ...doc, contact }, field);
          }}
        />
      </div>
    </section>
  );
}
