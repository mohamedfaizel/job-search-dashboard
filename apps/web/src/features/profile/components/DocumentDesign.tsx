import type {
  DocumentStyle,
  DocumentStyleInput,
  DocumentTemplate,
  WordTemplate,
} from '@jobsearch/data';
import {
  documentPreviewUrl,
  getErrorMessage,
  PHOTO_URL,
  useDeletePhoto,
  useDocumentStyle,
  useDocumentTemplates,
  useUpdateDocumentStyle,
  useUploadPhoto,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

const BUTTON =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const SELECT = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm';
const LINK = 'text-sm text-indigo-700 hover:underline';

/** Colours that print well and look calm on a resume. */
const SWATCHES = [
  { hex: '1F4E79', name: 'navy' },
  { hex: '0E7C66', name: 'teal' },
  { hex: '374151', name: 'graphite' },
  { hex: '7C2D12', name: 'burgundy' },
  { hex: '4338CA', name: 'indigo' },
  { hex: '9A6B00', name: 'ochre' },
] as const;

/** <b> in a message: a name to stand out. */
const bold = (chunks: ReactNode) => <span className="font-medium text-slate-800">{chunks}</span>;

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Template choice as a radio card, with a link to a sample PDF in your colours. */
function TemplateCard({
  template,
  checked,
  previewUrl,
  onChoose,
}: {
  template: DocumentTemplate;
  checked: boolean;
  previewUrl: string;
  onChoose: () => void;
}) {
  const t = useTranslations('Profile.design');
  const id = useId();
  return (
    <div
      className={`rounded-lg border p-3 ${checked ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500' : 'border-slate-200'}`}
    >
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="radio"
          name="resume-template"
          checked={checked}
          onChange={onChoose}
          className="mt-1"
        />
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
          <span className="block text-sm font-medium text-slate-900">{template.name}</span>
          <span className="block text-xs text-slate-600">{template.description}</span>
        </label>
      </div>
      <a
        href={previewUrl}
        target="_blank"
        rel="noreferrer"
        className={`${LINK} mt-2 inline-block pl-6`}
        aria-label={t('previewLabel', { name: template.name })}
      >
        {t('preview')}
      </a>
    </div>
  );
}

function Photo({ style }: { style: DocumentStyle }) {
  const t = useTranslations('Profile.design');
  const upload = useUploadPhoto();
  const remove = useDeletePhoto();
  const inputId = useId();
  const [tooBig, setTooBig] = useState(false);
  // A new photo gets a new address, so the browser doesn't show the old one from its cache.
  const [version, setVersion] = useState(0);
  const error = upload.error ?? remove.error;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {style.hasPhoto && (
        <img
          src={`${PHOTO_URL}?v=${String(version)}`}
          alt={t('photoAlt')}
          className="h-20 w-16 rounded border border-slate-200 object-cover"
        />
      )}
      <label htmlFor={inputId} className={`${BUTTON} cursor-pointer`}>
        {upload.isPending ? t('uploading') : style.hasPhoto ? t('changePhoto') : t('uploadPhoto')}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          aria-label={t('uploadPhotoLabel')}
          disabled={upload.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setTooBig(file.size > MAX_PHOTO_BYTES);
            if (file.size > MAX_PHOTO_BYTES) return;
            upload.mutate(file, {
              onSuccess: () => {
                setVersion((v) => v + 1);
              },
            });
          }}
        />
      </label>
      {style.hasPhoto && (
        <button
          type="button"
          className="text-sm text-red-700 hover:underline disabled:opacity-50"
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate();
          }}
        >
          {t('removePhoto')}
        </button>
      )}
      <span className="text-xs text-slate-500">{t('photoHint')}</span>
      {(tooBig || error) && (
        <p role="alert" className="basis-full text-sm text-red-700">
          {tooBig ? t('photoTooBig') : getErrorMessage(error)}
        </p>
      )}
    </div>
  );
}

/**
 * Your Word master resume as a template: what was found in it, or how to get there.
 */
function WordFileNote({ word }: { word: WordTemplate | null }) {
  const t = useTranslations('Profile.design');
  if (!word) {
    return <p className="text-xs text-slate-500">{t('wordNone')}</p>;
  }
  if (!word.usable) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <p>{t.rich('wordUnusable', { file: word.fileName, b: bold })}</p>
        <ul className="mt-1 list-disc pl-5">
          {word.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <p>
        {t.rich('wordUses', { file: word.fileName, sections: word.sections.join(', '), b: bold })}
      </p>
      {word.warnings.map((w) => (
        <p key={w} className="text-amber-800">
          {w}
        </p>
      ))}
      <p>{t('wordPdf')}</p>
    </div>
  );
}

/** Edits a copy of the saved style; Save sends it. */
function DesignForm({ saved }: { saved: DocumentStyle }) {
  const t = useTranslations('Profile.design');
  const templates = useDocumentTemplates();
  const update = useUpdateDocumentStyle();
  const [draft, setDraft] = useState<DocumentStyleInput>({
    resumeTemplate: saved.resumeTemplate,
    coverLetterLayout: saved.coverLetterLayout,
    accentColor: saved.accentColor,
    font: saved.font,
    showPhoto: saved.showPhoto,
  });
  const [done, setDone] = useState(false);
  const change = (patch: Partial<DocumentStyleInput>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDone(false);
  };
  const colourId = useId();
  const fontId = useId();
  const layoutId = useId();
  const photoId = useId();
  const changed =
    draft.resumeTemplate !== saved.resumeTemplate ||
    draft.coverLetterLayout !== saved.coverLetterLayout ||
    draft.accentColor.toUpperCase() !== saved.accentColor.toUpperCase() ||
    draft.font !== saved.font ||
    draft.showPhoto !== saved.showPhoto;
  const look = { accent: draft.accentColor, font: draft.font };
  const data = templates.data;

  return (
    <div className="space-y-5">
      {data && !data.rendererAvailable && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {data.rendererConfigured ? t('rendererOff') : t('rendererMissing')}{' '}
          <code className="rounded bg-amber-100 px-1">pnpm pdf:up</code>.
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">{t('template')}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
          {data?.resumeTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              checked={draft.resumeTemplate === template.id}
              previewUrl={documentPreviewUrl('resume', { template: template.id, ...look })}
              onChoose={() => {
                change({ resumeTemplate: template.id });
              }}
            />
          ))}
        </div>
        {data && <WordFileNote word={data.wordTemplate} />}
      </fieldset>

      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-1">
          <span id={colourId} className="block text-sm font-medium text-slate-700">
            {t('colour')}
          </span>
          <div role="radiogroup" aria-labelledby={colourId} className="flex items-center gap-2">
            {SWATCHES.map((s) => (
              <button
                key={s.hex}
                type="button"
                role="radio"
                aria-checked={draft.accentColor.toUpperCase() === s.hex}
                aria-label={t(`swatches.${s.name}`)}
                title={t(`swatches.${s.name}`)}
                onClick={() => {
                  change({ accentColor: s.hex });
                }}
                className="h-7 w-7 rounded-full ring-offset-2 aria-checked:ring-2 aria-checked:ring-slate-900"
                style={{ backgroundColor: `#${s.hex}` }}
              />
            ))}
            <input
              type="color"
              aria-label={t('ownColour')}
              value={`#${draft.accentColor.replace(/^#/, '')}`}
              onChange={(e) => {
                change({ accentColor: e.target.value.replace(/^#/, '').toUpperCase() });
              }}
              className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white"
            />
          </div>
          {draft.resumeTemplate === 'mine' && (
            <p className="text-xs text-slate-500">{t('wordColours')}</p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor={fontId} className="block text-sm font-medium text-slate-700">
            {t('type')}
          </label>
          <select
            id={fontId}
            value={draft.font}
            onChange={(e) => {
              change({ font: e.target.value });
            }}
            className={SELECT}
          >
            <option value="auto">{t('fontAuto')}</option>
            <option value="sans">{t('fontSans')}</option>
            <option value="serif">{t('fontSerif')}</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            id={photoId}
            type="checkbox"
            checked={draft.showPhoto}
            disabled={!saved.hasPhoto}
            onChange={(e) => {
              change({ showPhoto: e.target.checked });
            }}
          />
          <label htmlFor={photoId} className="text-sm font-medium text-slate-700">
            {t('showPhoto')}
          </label>
        </div>
        <Photo style={saved} />
      </div>

      <div className="space-y-1">
        <label htmlFor={layoutId} className="block text-sm font-medium text-slate-700">
          {t('layout')}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            id={layoutId}
            value={draft.coverLetterLayout}
            onChange={(e) => {
              change({ coverLetterLayout: e.target.value });
            }}
            className={SELECT}
          >
            {data?.coverLetterLayouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <a
            href={documentPreviewUrl('cover-letter', {
              template: draft.resumeTemplate,
              layout: draft.coverLetterLayout === 'auto' ? 'modern' : draft.coverLetterLayout,
              ...look,
            })}
            target="_blank"
            rel="noreferrer"
            className={LINK}
          >
            {t('previewLetter')}
          </a>
        </div>
        <p className="text-xs text-slate-500">
          {data?.coverLetterLayouts.find((l) => l.id === draft.coverLetterLayout)?.description}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!changed || update.isPending}
          onClick={() => {
            update.mutate(draft, {
              onSuccess: () => {
                setDone(true);
              },
            });
          }}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {update.isPending ? t('saving') : t('save')}
        </button>
        {done && !changed && (
          <p role="status" className="text-sm text-emerald-700">
            {t('saved')}
          </p>
        )}
        {update.isError && (
          <p role="alert" className="text-sm text-red-700">
            {t('saveFailed', { error: getErrorMessage(update.error) })}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * How the resume and cover letter PDFs look: one of the built-in templates, your accent
 * colour, type and photo. Claude writes the words; the template only lays them out, and the
 * PDF properties name only you.
 */
export function DocumentDesign() {
  const t = useTranslations('Profile.design');
  const style = useDocumentStyle();
  return (
    <section
      aria-labelledby="design-heading"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <div>
        <h2 id="design-heading" className="text-lg font-semibold text-slate-900">
          {t('heading')}
        </h2>
        <p className="text-sm text-slate-600">{t('intro')}</p>
      </div>
      {style.isPending ? (
        <p className="text-sm text-slate-500">{t('loading')}</p>
      ) : style.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {getErrorMessage(style.error)}
        </p>
      ) : (
        <DesignForm saved={style.data} />
      )}
    </section>
  );
}
