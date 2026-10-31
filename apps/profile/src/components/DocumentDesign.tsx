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
import { useId, useState } from 'react';

const BUTTON =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const SELECT = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm';
const LINK = 'text-sm text-indigo-700 hover:underline';

/** Colours that print well and look calm on a resume. */
const SWATCHES = [
  { hex: '1F4E79', name: 'Navy' },
  { hex: '0E7C66', name: 'Teal' },
  { hex: '374151', name: 'Graphite' },
  { hex: '7C2D12', name: 'Burgundy' },
  { hex: '4338CA', name: 'Indigo' },
  { hex: '9A6B00', name: 'Ochre' },
];

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
        aria-label={`Preview ${template.name} (PDF)`}
      >
        Preview PDF ↗
      </a>
    </div>
  );
}

function Photo({ style }: { style: DocumentStyle }) {
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
          alt="You, as on your resume"
          className="h-20 w-16 rounded border border-slate-200 object-cover"
        />
      )}
      <label htmlFor={inputId} className={`${BUTTON} cursor-pointer`}>
        {upload.isPending ? 'Uploading…' : style.hasPhoto ? 'Change photo' : 'Upload a photo'}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          aria-label="Upload a photo (JPEG or PNG)"
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
          Remove photo
        </button>
      )}
      <span className="text-xs text-slate-500">
        JPEG or PNG, up to 2 MB. Common in Germany, optional elsewhere.
      </span>
      {(tooBig || error) && (
        <p role="alert" className="basis-full text-sm text-red-700">
          {tooBig ? 'That photo is over 2 MB.' : getErrorMessage(error)}
        </p>
      )}
    </div>
  );
}

/**
 * Your Word master resume as a template: what was found in it, or how to get there.
 */
function WordFileNote({ word }: { word: WordTemplate | null }) {
  if (!word) {
    return (
      <p className="text-xs text-slate-500">
        Want your own layout? Upload your master resume as a Word (.docx) file above, and “My own
        Word file” appears here.
      </p>
    );
  }
  if (!word.usable) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <p>
          <span className="font-medium">{word.fileName}</span> can’t be used as a template yet.
        </p>
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
        <span className="font-medium text-slate-800">My own Word file</span> uses{' '}
        <span className="font-medium text-slate-800">{word.fileName}</span>: everything above your
        first heading stays as it is, and each section is written in the style of yours (found:{' '}
        {word.sections.join(', ')}).
      </p>
      {word.warnings.map((w) => (
        <p key={w} className="text-amber-800">
          {w}
        </p>
      ))}
      <p>
        Step 3 of the Apply kit then offers a Word download you can edit. The PDF is made with
        LibreOffice, which may swap a font it doesn’t have; for an exact PDF, open the Word file and
        save it as PDF.
      </p>
    </div>
  );
}

/** Edits a copy of the saved style; Save sends it. */
function DesignForm({ saved }: { saved: DocumentStyle }) {
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
          {data.rendererConfigured
            ? 'The PDF renderer isn’t running, so downloads are plain PDFs for now. Start it with '
            : 'PDF templates are switched off: set PDF_RENDERER_URL in .env, then start the renderer with '}
          <code className="rounded bg-amber-100 px-1">pnpm pdf:up</code>.
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Resume template</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {data?.resumeTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              checked={draft.resumeTemplate === t.id}
              previewUrl={documentPreviewUrl('resume', { template: t.id, ...look })}
              onChoose={() => {
                change({ resumeTemplate: t.id });
              }}
            />
          ))}
        </div>
        {data && <WordFileNote word={data.wordTemplate} />}
      </fieldset>

      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-1">
          <span id={colourId} className="block text-sm font-medium text-slate-700">
            Accent colour
          </span>
          <div role="radiogroup" aria-labelledby={colourId} className="flex items-center gap-2">
            {SWATCHES.map((s) => (
              <button
                key={s.hex}
                type="button"
                role="radio"
                aria-checked={draft.accentColor.toUpperCase() === s.hex}
                aria-label={s.name}
                title={s.name}
                onClick={() => {
                  change({ accentColor: s.hex });
                }}
                className="h-7 w-7 rounded-full ring-offset-2 aria-checked:ring-2 aria-checked:ring-slate-900"
                style={{ backgroundColor: `#${s.hex}` }}
              />
            ))}
            <input
              type="color"
              aria-label="Your own colour"
              value={`#${draft.accentColor.replace(/^#/, '')}`}
              onChange={(e) => {
                change({ accentColor: e.target.value.replace(/^#/, '').toUpperCase() });
              }}
              className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white"
            />
          </div>
          {draft.resumeTemplate === 'mine' && (
            <p className="text-xs text-slate-500">
              Your Word file keeps its own colours and fonts; these are for the cover letter.
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor={fontId} className="block text-sm font-medium text-slate-700">
            Type
          </label>
          <select
            id={fontId}
            value={draft.font}
            onChange={(e) => {
              change({ font: e.target.value });
            }}
            className={SELECT}
          >
            <option value="auto">The template’s own</option>
            <option value="sans">Sans-serif (Heros)</option>
            <option value="serif">Serif (Pagella)</option>
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
            Show my photo on the resume
          </label>
        </div>
        <Photo style={saved} />
      </div>

      <div className="space-y-1">
        <label htmlFor={layoutId} className="block text-sm font-medium text-slate-700">
          Cover letter layout
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
            Preview cover letter ↗
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
          {update.isPending ? 'Saving…' : 'Save design'}
        </button>
        {done && !changed && (
          <p role="status" className="text-sm text-emerald-700">
            Design saved. Your next PDF downloads use it.
          </p>
        )}
        {update.isError && (
          <p role="alert" className="text-sm text-red-700">
            Could not save: {getErrorMessage(update.error)}
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
  const style = useDocumentStyle();
  return (
    <section
      aria-labelledby="design-heading"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <div>
        <h2 id="design-heading" className="text-lg font-semibold text-slate-900">
          Resume and cover letter design
        </h2>
        <p className="text-sm text-slate-600">
          How the PDFs you download for a job look. Every template is one column with real text, so
          applicant tracking systems read it.
        </p>
      </div>
      {style.isPending ? (
        <p className="text-sm text-slate-500">Loading…</p>
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
