'use client';

import type { BuilderDoc, ResumeBuild } from '@jobsearch/data';
import { resumeBuildPdfUrl, useResumeBuild, useSaveResumeBuild } from '@jobsearch/data';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { useErrorText } from '../../i18n/useErrorText';
import type { TabItem } from '../profile/components/TabList';
import { TabList } from '../profile/components/TabList';
import { useLanguageName } from '../profile/components/useLanguageName';
import { HeaderCard } from './components/HeaderCard';
import { LookPanel } from './components/LookPanel';
import { PdfPreview } from './components/PdfPreview';
import { ReadAgain } from './components/ReadAgain';
import { SectionCard } from './components/SectionCard';
import { SMALL_BUTTON } from './components/ui';
import { useDragSort } from './components/useDragSort';
import type { SectionPreset } from './docOps';
import {
  copySection,
  historyReducer,
  insertAt,
  move,
  newSection,
  presetTitle,
  removeAt,
  SECTION_PRESETS,
  startHistory,
  updateSection,
} from './docOps';

/** Wait this long after the last keystroke before saving (and making a new preview). */
const AUTOSAVE_MS = 1000;

export type BuilderTab = 'edit' | 'look';
const TABS: BuilderTab[] = ['edit', 'look'];

const param = (name: string) =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(name);

/** The page address for a language and tab, so a reload or a shared link opens the same. */
function builderUrl(language: string | null, tab: BuilderTab): string {
  const params = new URLSearchParams();
  if (language) params.set('language', language);
  if (tab !== 'edit') params.set('tab', tab);
  const query = params.toString();
  return query ? `/resume?${query}` : '/resume';
}

/**
 * The Resume builder: your master resume section by section on the left, the real PDF on the
 * right. Changes save on their own; Undo goes back step by step. ?language=de opens your German
 * resume, ?tab=look the Look tab (template, colour, size and spacing).
 */
export function ResumeBuilderPage() {
  const t = useTranslations('Resume');
  const errorText = useErrorText();
  const router = useRouter();
  const [language, setLanguage] = useState<string | null>(() => param('language'));
  const [tab, setTab] = useState<BuilderTab>(
    () => TABS.find((id) => id === param('tab')) ?? 'edit',
  );
  const build = useResumeBuild(language);

  if (build.isPending) return <p className="text-sm text-slate-500">{t('loading')}</p>;
  if (build.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(build.error)}
      </p>
    );
  }
  return (
    <Builder
      // Another language is another resume: start its editor fresh.
      key={build.data.language}
      build={build.data}
      tab={tab}
      onTab={(next) => {
        setTab(next);
        router.replace(builderUrl(language, next));
      }}
      onLanguage={(next) => {
        setLanguage(next);
        router.replace(builderUrl(next, tab));
      }}
    />
  );
}

type View = 'edit' | 'preview';

function Builder({
  build,
  tab,
  onTab,
  onLanguage,
}: {
  build: ResumeBuild;
  tab: BuilderTab;
  onTab: (tab: BuilderTab) => void;
  onLanguage: (language: string) => void;
}) {
  const t = useTranslations('Resume');
  const tabs: TabItem<BuilderTab>[] = TABS.map((id) => ({ id, label: t(`tabs.${id}`) }));
  const errorText = useErrorText();
  const nameOf = useLanguageName();
  const save = useSaveResumeBuild();
  const [history, dispatch] = useReducer(historyReducer, build.doc, (json: string) =>
    startHistory(JSON.parse(json) as BuilderDoc),
  );
  // The doc as the server has it, to tell whether there is anything to save.
  const [savedJson, setSavedJson] = useState(build.doc);
  const [version, setVersion] = useState(build.savedAt ?? 'first');
  const [outOfDate, setOutOfDate] = useState(build.outOfDate);
  const [view, setView] = useState<View>('edit');
  const doc = history.present;
  const json = JSON.stringify(doc);
  const unsaved = json !== savedJson;
  const { language } = build;

  const change = useCallback((next: BuilderDoc, field: string | null) => {
    dispatch({ type: 'change', doc: next, field, at: Date.now() });
  }, []);

  const saveNow = useCallback(
    (text: string) => {
      save.mutate(
        { language, doc: text },
        {
          onSuccess: (saved) => {
            setSavedJson(text);
            setOutOfDate(false);
            setVersion(saved.savedAt ?? String(Date.now()));
          },
        },
      );
    },
    // `save.mutate` is stable; the whole `save` object changes on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, save.mutate],
  );

  // Autosave: a second after the last change.
  useEffect(() => {
    if (!unsaved) return;
    const timer = setTimeout(() => {
      saveNow(json);
    }, AUTOSAVE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [json, unsaved, saveNow]);

  // Leaving with changes not saved yet asks first.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [unsaved]);

  // Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y) undo and redo the builder's changes, also inside a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: 'undo' });
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        dispatch({ type: 'redo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // A new look makes a new PDF: the preview asks again.
  const lookSaved = useCallback(() => {
    setVersion(`look-${String(Date.now())}`);
  }, []);

  const sectionDrag = useDragSort('sections', (from, to) => {
    change({ ...doc, sections: move(doc.sections, from, to) }, null);
  });

  const status = save.isPending
    ? t('status.saving')
    : save.isError && unsaved
      ? t('status.failed')
      : unsaved
        ? t('status.unsaved')
        : t('status.saved');

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold text-slate-900">{t('title')}</h1>
        {build.languages.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span className="sr-only">{t('language')}</span>
            <select
              value={language}
              onChange={(event) => {
                onLanguage(event.target.value);
              }}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium"
            >
              {build.languages.map((code) => (
                <option key={code} value={code}>
                  {t('resumeIn', { language: nameOf(code) })}
                </option>
              ))}
            </select>
          </label>
        )}
        <span
          role="status"
          className={`text-sm font-medium ${
            save.isError && unsaved
              ? 'text-red-700'
              : unsaved || save.isPending
                ? 'text-slate-500'
                : 'text-emerald-700'
          }`}
        >
          {status}
        </span>
        {save.isError && unsaved && (
          <button
            type="button"
            className={SMALL_BUTTON}
            onClick={() => {
              saveNow(json);
            }}
          >
            {t('retry')}
          </button>
        )}
        <button
          type="button"
          className={SMALL_BUTTON}
          disabled={!history.past.length}
          aria-keyshortcuts="Control+Z"
          onClick={() => {
            dispatch({ type: 'undo' });
          }}
        >
          ↶ {t('undo')}
        </button>
        <button
          type="button"
          className={SMALL_BUTTON}
          disabled={!history.future.length}
          aria-keyshortcuts="Control+Shift+Z"
          onClick={() => {
            dispatch({ type: 'redo' });
          }}
        >
          ↷ {t('redo')}
        </button>
        {unsaved || save.isPending ? (
          <span
            aria-disabled
            title={t('downloadWait')}
            className="cursor-not-allowed rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white opacity-50"
          >
            ⬇ {t('download')}
          </span>
        ) : (
          <a
            href={resumeBuildPdfUrl(language, true)}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            ⬇ {t('download')}
          </a>
        )}
      </div>
      {save.isError && unsaved && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(save.error)}
        </p>
      )}

      <TabList
        label={t('tabsLabel')}
        idPrefix="builder-tab"
        panelId="builder-panel"
        tabs={tabs}
        selected={tab}
        onSelect={onTab}
      />

      <ReadAgain
        language={language}
        outOfDate={outOfDate}
        onRead={(read) => {
          dispatch({ type: 'reset', doc: JSON.parse(read.doc) as BuilderDoc });
          setSavedJson(read.doc);
          setOutOfDate(false);
          setVersion(read.savedAt ?? String(Date.now()));
        }}
        onKeep={() => {
          saveNow(json);
        }}
      />

      {/* Phones show one side at a time. */}
      <div
        role="group"
        aria-label={t('view')}
        className="flex gap-1 rounded-lg bg-slate-100 p-1 lg:hidden"
      >
        {(['edit', 'preview'] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => {
              setView(id);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
              view === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t(`views.${id}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div
          id="builder-panel"
          role="tabpanel"
          aria-labelledby={`builder-tab-${tab}`}
          className={`min-w-0 ${view === 'edit' ? '' : 'hidden lg:block'}`}
        >
          {/* Both tabs stay mounted, so a change waiting to be saved survives switching. */}
          <div hidden={tab !== 'look'}>
            <LookPanel onSaved={lookSaved} />
          </div>
          <div hidden={tab !== 'edit'} className="space-y-3">
            <p className="text-xs text-slate-500">{t('intro')}</p>
            <HeaderCard doc={doc} onChange={change} />
            {doc.sections.map((section, index) => (
              <SectionCard
                key={section.id}
                section={section}
                index={index}
                count={doc.sections.length}
                profileLanguages={build.profileLanguages}
                gripProps={sectionDrag.grip(index)}
                rowProps={sectionDrag.row(index)}
                dropHere={sectionDrag.over === index}
                onChange={(next, field) => {
                  change(
                    updateSection(doc, section.id, () => next),
                    field,
                  );
                }}
                onMove={(to) => {
                  change({ ...doc, sections: move(doc.sections, index, to) }, null);
                }}
                onDuplicate={() => {
                  const copy = copySection(section, t('copyOf', { title: section.title }));
                  change({ ...doc, sections: insertAt(doc.sections, index + 1, copy) }, null);
                }}
                onDelete={() => {
                  change({ ...doc, sections: removeAt(doc.sections, index) }, null);
                }}
              />
            ))}
            <AddSection
              language={language}
              onAdd={(preset) => {
                change(
                  {
                    ...doc,
                    sections: [...doc.sections, newSection(preset, presetTitle(preset, language))],
                  },
                  null,
                );
              }}
            />
          </div>
        </div>
        <div className={`min-w-0 ${view === 'preview' ? '' : 'hidden lg:block'}`}>
          <div className="lg:sticky lg:top-4">
            <PdfPreview language={language} version={version} maxPages={build.maxPages} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** "+ Add section": the usual sections, titled in the resume's language, or your own. */
function AddSection({
  language,
  onAdd,
}: {
  language: string;
  onAdd: (preset: SectionPreset) => void;
}) {
  const t = useTranslations('Resume');
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-300 p-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
        }}
        className="w-full text-center text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        + {t('addSection')}
      </button>
      {open && (
        <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
          {SECTION_PRESETS.map((preset) => (
            <li key={preset}>
              <button
                type="button"
                className={SMALL_BUTTON}
                onClick={() => {
                  onAdd(preset);
                  setOpen(false);
                }}
              >
                {preset === 'custom' ? t('preset.custom') : presetTitle(preset, language)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
