import type {
  DocumentStyle,
  DocumentStyleInput,
  DocumentTemplate,
  MyDesign,
  WordTemplate,
} from '@jobsearch/data';
import {
  documentPreviewUrl,
  PHOTO_URL,
  useDeleteMyDesign,
  useDeletePhoto,
  useDocumentStyle,
  useDocumentTemplates,
  useSaveMyDesign,
  useUpdateDocumentStyle,
  useUploadPhoto,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { useAiChat } from '../../../lib/ai-chat';

const BUTTON =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const SELECT = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm';
const LINK = 'text-sm text-brand-700 hover:underline';

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

/**
 * Template choice as a small chip: the name only. The PDF next to it shows the look, and the
 * description is the tooltip.
 */
function TemplateChip({
  template,
  checked,
  onChoose,
}: {
  template: DocumentTemplate;
  checked: boolean;
  onChoose: () => void;
}) {
  return (
    <label
      title={template.description}
      className={`flex cursor-pointer items-center justify-center rounded-md border px-2 py-1.5 text-center text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${
        checked
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <input
        type="radio"
        name="resume-template"
        checked={checked}
        onChange={onChoose}
        className="sr-only"
      />
      {template.name}
    </label>
  );
}

function Photo({ style, onSaved }: { style: DocumentStyle; onSaved: () => void }) {
  const errorText = useErrorText();
  const t = useTranslations('Resume.look');
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
                onSaved();
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
            remove.mutate(undefined, { onSuccess: onSaved });
          }}
        >
          {t('removePhoto')}
        </button>
      )}
      <span className="text-xs text-slate-500">{t('photoHint')}</span>
      {(tooBig || error) && (
        <p role="alert" className="basis-full text-sm text-red-700">
          {tooBig ? t('photoTooBig') : errorText(error)}
        </p>
      )}
    </div>
  );
}

/**
 * Your Word master resume as a template: what was found in it, or how to get there.
 */
function WordFileNote({ word }: { word: WordTemplate | null }) {
  const t = useTranslations('Resume.look');
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

/** What My design took from your resume, as short labels. */
function designChips(d: MyDesign, t: ReturnType<typeof useTranslations<'Resume.look'>>) {
  return [
    t(`myDesignFont.${d.font}`),
    t(`myDesignAlign.${d.align}`),
    t(`myDesignHeading.${d.headingStyle}`),
    d.headingCase === 'upper' ? t('myDesignCaps') : null,
    d.dates === 'right' ? t('myDesignDatesRight') : t('myDesignDatesBelow'),
    d.companyFirst ? t('myDesignCompanyFirst') : null,
    d.skillsFirst ? t('myDesignSkillsFirst') : null,
    d.density === 'compact' ? t('myDesignCompact') : null,
  ].filter((c): c is string => !!c);
}

/**
 * My design: Claude looks at your own resume file (you attach it in Claude) and answers with its
 * design settings; saving them adds "My design" to the templates, in one clean LaTeX column.
 */
function MyDesignCard({ saved, onSaved }: { saved: DocumentStyle; onSaved: () => void }) {
  const errorText = useErrorText();
  const t = useTranslations('Resume.look');
  const chat = useAiChat();
  const templates = useDocumentTemplates();
  const save = useSaveMyDesign();
  const remove = useDeleteMyDesign();
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  const [redo, setRedo] = useState(false);
  const replyId = useId();
  const prompt = templates.data?.designPrompt ?? '';
  const design = saved.myDesign;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
    window.open(chat.url, '_blank', 'noopener');
  };

  if (design && !redo) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{t('myDesignTitle')}</h3>
          <span
            className="h-4 w-4 rounded-full ring-1 ring-slate-300"
            style={{ backgroundColor: `#${design.accent}` }}
            title={`#${design.accent}`}
          />
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label={t('myDesignTook')}>
          {designChips(design, t).map((chip) => (
            <li key={chip} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {chip}
            </li>
          ))}
        </ul>
        {design.twoColumns && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t('myDesignTwoColumns')}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              setRedo(true);
            }}
          >
            {t('myDesignRedo')}
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(undefined, { onSuccess: onSaved });
            }}
          >
            {t('myDesignDelete')}
          </button>
        </div>
      </div>
    );
  }

  return (
    // Closed until you want it (or open while making it again), so the tab stays short.
    <details open={redo} className="space-y-3 rounded-lg border border-slate-200 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-slate-800">
        {t('myDesignMake')}
      </summary>
      <p className="mt-2 text-sm text-slate-600">{t('myDesignIntro')}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>{t('myDesignStep1')}</li>
        <li>{t('myDesignStep2')}</li>
        <li>{t('myDesignStep3')}</li>
      </ol>
      <button
        type="button"
        disabled={!prompt}
        onClick={() => {
          void copy();
        }}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {t('myDesignCopy')}
      </button>
      {copied === 'failed' && (
        <details open className="text-xs text-slate-600">
          <summary>{t('myDesignCopyFailed')}</summary>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-2">
            {prompt}
          </pre>
        </details>
      )}
      <div className="space-y-1">
        <label htmlFor={replyId} className="block text-sm font-medium text-slate-700">
          {t('myDesignReply')}
        </label>
        <textarea
          id={replyId}
          rows={4}
          value={reply}
          onChange={(e) => {
            setReply(e.target.value);
          }}
          placeholder='{ "font": "serif", … }'
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!reply.trim() || save.isPending}
          onClick={() => {
            save.mutate(reply, {
              onSuccess: () => {
                setReply('');
                setRedo(false);
                onSaved();
              },
            });
          }}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {save.isPending ? t('saving') : t('myDesignSave')}
        </button>
        {redo && (
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              setRedo(false);
            }}
          >
            {t('myDesignCancel')}
          </button>
        )}
        {save.isError && (
          <p role="alert" className="text-sm text-red-700">
            {errorText(save.error)}
          </p>
        )}
      </div>
    </details>
  );
}

/** Wait this long after the last change before saving (sliders send many). */
const SAVE_MS = 500;

const inputOf = (style: DocumentStyle): DocumentStyleInput => ({
  resumeTemplate: style.resumeTemplate,
  coverLetterLayout: style.coverLetterLayout,
  accentColor: style.accentColor,
  font: style.font,
  showPhoto: style.showPhoto,
  fontSize: style.fontSize,
  margin: style.margin,
  lineSpacing: style.lineSpacing,
  compact: style.compact,
  skillsStyle: style.skillsStyle,
  skillsBold: style.skillsBold,
  headingStyle: style.headingStyle,
  datesSide: style.datesSide,
  bulletStyle: style.bulletStyle,
  designAccent: style.myDesign?.accent ?? null,
});

const sameInput = (a: DocumentStyleInput, b: DocumentStyleInput) =>
  JSON.stringify({ ...a, accentColor: a.accentColor.toUpperCase() }) ===
  JSON.stringify({ ...b, accentColor: b.accentColor.toUpperCase() });

/** A slider that shows its value; at null it sits on the template's own value. */
function Slider({
  label,
  value,
  fallback,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number | null;
  fallback: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const t = useTranslations('Resume.look');
  const id = useId();
  const shown = value ?? fallback;
  const text = value === null ? t('templateValue', { value: format(fallback) }) : format(value);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <span className="text-xs tabular-nums text-slate-600">{text}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        aria-valuetext={text}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="w-full accent-brand-600"
      />
    </div>
  );
}

/** Text size, margins, line spacing and compact mode for the resume. */
function Spacing({
  draft,
  template,
  onChange,
  inline = false,
}: {
  draft: DocumentStyleInput;
  template: DocumentTemplate | undefined;
  onChange: (patch: Partial<DocumentStyleInput>) => void;
  /** One row in the toolbar: no box, no hint. */
  inline?: boolean;
}) {
  const t = useTranslations('Resume.look');
  const compactId = useId();
  const word = draft.resumeTemplate === 'mine';
  const own =
    draft.fontSize === null && draft.margin === null && draft.lineSpacing === 1 && !draft.compact;
  return (
    <fieldset
      className={
        inline
          ? 'flex w-full min-w-0 flex-wrap items-end gap-x-4 gap-y-2 sm:w-auto'
          : 'space-y-3 rounded-lg border border-slate-200 p-4'
      }
      title={inline ? (word ? t('wordSpacing') : t('spacingHint')) : undefined}
    >
      <legend className={inline ? 'sr-only' : 'px-1 text-sm font-semibold text-slate-900'}>
        {t('spacing')}
      </legend>
      {!inline && (
        <p className="text-xs text-slate-500">{word ? t('wordSpacing') : t('spacingHint')}</p>
      )}
      <div
        className={`grid gap-4 ${inline ? 'w-full sm:w-[34rem] sm:grid-cols-3' : 'sm:grid-cols-3'} ${word ? 'opacity-50' : ''}`}
      >
        <Slider
          label={t('fontSize')}
          value={draft.fontSize}
          fallback={template?.fontSize ?? 11}
          min={9}
          max={12}
          step={0.5}
          format={(v) => `${String(v)} pt`}
          onChange={(fontSize) => {
            onChange({ fontSize });
          }}
        />
        <Slider
          label={t('margin')}
          value={draft.margin}
          fallback={template?.margin ?? 19}
          min={10}
          max={25}
          step={1}
          format={(v) => `${String(v)} mm`}
          onChange={(margin) => {
            onChange({ margin });
          }}
        />
        <Slider
          label={t('lineSpacing')}
          value={draft.lineSpacing}
          fallback={1}
          min={1}
          max={1.4}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(lineSpacing) => {
            onChange({ lineSpacing });
          }}
        />
      </div>
      <div className={`flex flex-wrap items-center gap-3 ${inline ? 'pb-1' : 'justify-between'}`}>
        <div className="flex items-center gap-2">
          <input
            id={compactId}
            type="checkbox"
            checked={draft.compact}
            onChange={(e) => {
              onChange({ compact: e.target.checked });
            }}
          />
          <label htmlFor={compactId} className="text-sm text-slate-700">
            {t('compact')}
          </label>
        </div>
        <button
          type="button"
          className="text-sm text-brand-700 hover:underline disabled:text-slate-400 disabled:no-underline"
          disabled={own}
          onClick={() => {
            onChange({ fontSize: null, margin: null, lineSpacing: 1, compact: false });
          }}
        >
          {t('reset')}
        </button>
      </div>
    </fieldset>
  );
}

/** One setting as a row of small choices; the description of each is its tooltip. */
function Choice({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string; hint: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="w-28 shrink-0 text-sm font-medium text-slate-700">
        {label}
      </span>
      {options.map((o) => (
        <label
          key={o.value}
          title={o.hint}
          className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${
            value === o.value
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={value === o.value}
            onChange={() => {
              onChange(o.value);
            }}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

/** Skills lines, section titles, dates and bullets: the small parts of the resume's look. */
function Details({
  draft,
  onChange,
}: {
  draft: DocumentStyleInput;
  onChange: (patch: Partial<DocumentStyleInput>) => void;
}) {
  const t = useTranslations('Resume.look.details');
  const opt = (group: string, values: string[]) =>
    values.map((v) => ({ value: v, label: t(`${group}.${v}`), hint: t(`${group}.${v}Hint`) }));
  return (
    <fieldset className="space-y-2 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">{t('title')}</legend>
      <Choice
        label={t('skills.label')}
        name="skills-style"
        value={draft.skillsStyle}
        options={opt('skills', ['index', 'lines', 'plain'])}
        onChange={(skillsStyle) => {
          onChange({ skillsStyle });
        }}
      />
      <Choice
        label={t('skillsLabel.label')}
        name="skills-label"
        value={draft.skillsBold ? 'bold' : 'normal'}
        options={opt('skillsLabel', ['bold', 'normal'])}
        onChange={(v) => {
          onChange({ skillsBold: v === 'bold' });
        }}
      />
      <Choice
        label={t('headings.label')}
        name="heading-style"
        value={draft.headingStyle}
        options={opt('headings', ['auto', 'rule', 'bold', 'bar'])}
        onChange={(headingStyle) => {
          onChange({ headingStyle });
        }}
      />
      <Choice
        label={t('dates.label')}
        name="dates-side"
        value={draft.datesSide}
        options={opt('dates', ['auto', 'right', 'below'])}
        onChange={(datesSide) => {
          onChange({ datesSide });
        }}
      />
      <Choice
        label={t('bullets.label')}
        name="bullet-style"
        value={draft.bulletStyle}
        options={opt('bullets', ['dot', 'dash', 'none'])}
        onChange={(bulletStyle) => {
          onChange({ bulletStyle });
        }}
      />
    </fieldset>
  );
}

/** Edits a copy of the saved style and saves it half a second after each change. */
function DesignForm({
  saved,
  onSaved,
  wide,
}: {
  saved: DocumentStyle;
  onSaved: () => void;
  wide: boolean;
}) {
  const errorText = useErrorText();
  const t = useTranslations('Resume.look');
  const templates = useDocumentTemplates();
  const update = useUpdateDocumentStyle();
  const [draft, setDraft] = useState<DocumentStyleInput>(() => inputOf(saved));
  // What the server has now, so a change made while saving is saved next.
  const [sent, setSent] = useState<DocumentStyleInput>(() => inputOf(saved));
  const change = (patch: Partial<DocumentStyleInput>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };
  const colourId = useId();
  const fontId = useId();
  const layoutId = useId();
  const photoId = useId();
  const templateId = useId();
  const changed = !sameInput(draft, sent);
  const { mutate, isPending } = update;

  useEffect(() => {
    if (!changed || isPending) return;
    const timer = setTimeout(() => {
      mutate(draft, {
        onSuccess: () => {
          setSent(draft);
          onSaved();
        },
      });
    }, SAVE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [changed, isPending, draft, mutate, onSaved]);

  // With My design chosen, the colour buttons change My design's own colour.
  const ownDesign = draft.resumeTemplate === 'design' && draft.designAccent != null;
  const colour = ownDesign ? (draft.designAccent ?? draft.accentColor) : draft.accentColor;
  const setColour = (hex: string) => {
    change(ownDesign ? { designAccent: hex } : { accentColor: hex });
  };
  const look = { accent: draft.accentColor, font: draft.font };
  const data = templates.data;
  const chosen = data?.resumeTemplates.find((tpl) => tpl.id === draft.resumeTemplate);

  // In the toolbar the groups get boxes of their own.
  const box = wide ? 'rounded-lg border border-slate-200 p-4' : '';
  const statusLine = (
    <p
      role="status"
      className={`text-sm font-medium ${update.isError ? 'text-red-700' : changed || isPending ? 'text-slate-500' : 'text-emerald-700'}`}
    >
      {isPending
        ? t('status.saving')
        : update.isError
          ? `${t('status.failed')}: ${errorText(update.error)}`
          : changed
            ? ''
            : t('status.saved')}
    </p>
  );
  const rendererNote = data && !data.rendererAvailable && (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {data.rendererConfigured ? t('rendererOff') : t('rendererMissing')}{' '}
      <code className="rounded bg-amber-100 px-1">pnpm pdf:up</code>.
    </p>
  );
  const colourAndType = (
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
              aria-checked={colour.toUpperCase() === s.hex}
              aria-label={t(`swatches.${s.name}`)}
              title={t(`swatches.${s.name}`)}
              onClick={() => {
                setColour(s.hex);
              }}
              className="h-7 w-7 rounded-full ring-offset-2 aria-checked:ring-2 aria-checked:ring-slate-900"
              style={{ backgroundColor: `#${s.hex}` }}
            />
          ))}
          <input
            type="color"
            aria-label={t('ownColour')}
            value={`#${colour.replace(/^#/, '')}`}
            onChange={(e) => {
              setColour(e.target.value.replace(/^#/, '').toUpperCase());
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
  );
  const photoBlock = (
    <div className={`space-y-2 ${box}`}>
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
      <Photo style={saved} onSaved={onSaved} />
    </div>
  );
  const letterLayout = (
    <div className={`space-y-1 ${box}`}>
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
  );

  if (wide) {
    return (
      <div className="space-y-2">
        {rendererNote}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="space-y-1">
            <label htmlFor={templateId} className="block text-sm font-medium text-slate-700">
              {t('template')}
            </label>
            <select
              id={templateId}
              value={draft.resumeTemplate}
              onChange={(e) => {
                change({ resumeTemplate: e.target.value });
              }}
              className={SELECT}
            >
              {data?.resumeTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          {colourAndType}
          <Spacing draft={draft} template={chosen} onChange={change} inline />
          {/* "Saved" is at the top of the page already; here only saving and errors show. */}
          {(changed || isPending || update.isError) && statusLine}
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-brand-700">
            {t('more')}
          </summary>
          <div className="mt-3 grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {draft.resumeTemplate !== 'mine' && <Details draft={draft} onChange={change} />}
            <div className={`space-y-2 ${box}`}>
              <MyDesignCard saved={saved} onSaved={onSaved} />
              {data && <WordFileNote word={data.wordTemplate} />}
            </div>
            {photoBlock}
            {letterLayout}
          </div>
        </details>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {statusLine}
      {rendererNote}

      <Spacing draft={draft} template={chosen} onChange={change} />
      {draft.resumeTemplate !== 'mine' && <Details draft={draft} onChange={change} />}

      {colourAndType}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">{t('template')}</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4">
          {data?.resumeTemplates.map((template) => (
            <TemplateChip
              key={template.id}
              template={template}
              checked={draft.resumeTemplate === template.id}
              onChoose={() => {
                change({ resumeTemplate: template.id });
              }}
            />
          ))}
        </div>
        <MyDesignCard saved={saved} onSaved={onSaved} />
        {data && <WordFileNote word={data.wordTemplate} />}
      </fieldset>

      {photoBlock}

      {letterLayout}
    </div>
  );
}

/**
 * The Look tab: how the resume and cover letter PDFs look. One of the built-in templates, your
 * accent colour, type, photo, text size and spacing. Every change saves on its own and the PDF
 * next to it is made again. This is the only place these settings live.
 */
export function LookPanel({ onSaved, wide = false }: { onSaved: () => void; wide?: boolean }) {
  const errorText = useErrorText();
  const t = useTranslations('Resume.look');
  const style = useDocumentStyle();
  return (
    <div className={wide ? 'space-y-2' : 'space-y-4'}>
      {!wide && <p className="text-xs text-slate-500">{t('intro')}</p>}
      {style.isPending ? (
        <p className="text-sm text-slate-500">{t('loading')}</p>
      ) : style.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {errorText(style.error)}
        </p>
      ) : (
        // Saving or deleting My design changes the default template: start the form again from it.
        <DesignForm
          key={style.data.myDesign ? 'design' : 'none'}
          saved={style.data}
          onSaved={onSaved}
          wide={wide}
        />
      )}
    </div>
  );
}
