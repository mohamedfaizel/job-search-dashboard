import type { BuilderBlock, BuilderSection } from '@jobsearch/data';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { HTMLAttributes } from 'react';
import { useState } from 'react';
import { isLanguagesSection, move, newBlock, removeAt, replaceAt } from '../docOps';
import { BlockEditor } from './BlockEditor';
import {
  CopyIcon,
  DownIcon,
  EyeIcon,
  EyeOffIcon,
  GripIcon,
  LockIcon,
  TrashIcon,
  UpIcon,
} from './icons';
import { ImprovePanel } from './ImprovePanel';
import { GRIP, ICON_BUTTON, SMALL_BUTTON } from './ui';

interface Props {
  section: BuilderSection;
  index: number;
  count: number;
  /** Your languages from My profile; the Languages section always shows these. */
  profileLanguages: string[];
  onChange: (section: BuilderSection, field: string | null) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /**
   * Set when editing a job's copy: this section differs from the master's (`changed`), and the
   * button puts it into the master.
   */
  master?: { changed: boolean; busy: boolean; onCopy: () => void };
  /** Offers "Improve with AI" for this section: the job it is for (null = master) and language. */
  improve?: { jobId: string | null; language: string };
  /** From the section list's drag: the grip starts a drag, the card takes a drop. */
  gripProps: HTMLAttributes<HTMLElement>;
  rowProps: HTMLAttributes<HTMLElement>;
  dropHere: boolean;
}

/** One section of the resume: its title, its blocks, and the buttons to move, hide or delete it. */
export function SectionCard({
  section,
  index,
  count,
  profileLanguages,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  master,
  improve,
  gripProps,
  rowProps,
  dropHere,
}: Props) {
  const t = useTranslations('Resume');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [improving, setImproving] = useState(false);
  const title = section.title || t('untitled');
  const locked = isLanguagesSection(section.title) && profileLanguages.length > 0;
  const setBlocks = (blocks: BuilderBlock[], field: string | null) => {
    onChange({ ...section, blocks }, field);
  };

  return (
    <section
      {...rowProps}
      aria-label={title}
      className={`rounded-lg border bg-white p-3 shadow-sm transition-opacity ${
        dropHere ? 'border-flag-gold ring-2 ring-flag-gold' : 'border-slate-200'
      } ${section.hidden ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-1">
        <span {...gripProps} className={GRIP} title={t('dragHint')} aria-hidden>
          <GripIcon />
        </span>
        <input
          value={section.title}
          aria-label={t('sectionTitle')}
          placeholder={t('untitled')}
          onChange={(event) => {
            onChange({ ...section, title: event.target.value }, `${section.id}:title`);
          }}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-slate-900 hover:border-slate-200 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        {section.hidden && (
          <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 sm:inline">
            {t('hiddenTag')}
          </span>
        )}
        {master?.changed && (
          <button
            type="button"
            disabled={master.busy}
            title={t('copyToMasterHint')}
            aria-label={t('copyToMaster', { title })}
            className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-50"
            onClick={master.onCopy}
          >
            {t('changedForJob')} · {t('copyToMasterShort')}
          </button>
        )}
        {improve && !locked && (
          <button
            type="button"
            className={`${ICON_BUTTON} font-bold text-amber-600`}
            aria-expanded={improving}
            aria-label={t('improve.open', { title })}
            title={t('improve.openShort')}
            onClick={() => {
              setImproving((open) => !open);
            }}
          >
            ✦
          </button>
        )}
        <button
          type="button"
          className={ICON_BUTTON}
          aria-pressed={section.hidden}
          aria-label={section.hidden ? t('showSection', { title }) : t('hideSection', { title })}
          title={section.hidden ? t('show') : t('hide')}
          onClick={() => {
            onChange({ ...section, hidden: !section.hidden }, null);
          }}
        >
          {section.hidden ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        <button
          type="button"
          className={ICON_BUTTON}
          disabled={index === 0}
          aria-label={t('moveUp', { title })}
          title={t('up')}
          onClick={() => {
            onMove(index - 1);
          }}
        >
          <UpIcon />
        </button>
        <button
          type="button"
          className={ICON_BUTTON}
          disabled={index === count - 1}
          aria-label={t('moveDown', { title })}
          title={t('down')}
          onClick={() => {
            onMove(index + 1);
          }}
        >
          <DownIcon />
        </button>
        <button
          type="button"
          className={ICON_BUTTON}
          aria-label={t('duplicate', { title })}
          title={t('duplicateShort')}
          onClick={onDuplicate}
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          className={`${ICON_BUTTON} hover:bg-red-50 hover:text-red-700`}
          aria-label={t('deleteSection', { title })}
          title={t('delete')}
          onClick={() => {
            setConfirmDelete(true);
          }}
        >
          <TrashIcon />
        </button>
      </div>

      {improve && improving && !locked && (
        <ImprovePanel
          section={section}
          jobId={improve.jobId}
          language={improve.language}
          onKeep={(next) => {
            onChange(next, null);
          }}
          onClose={() => {
            setImproving(false);
          }}
        />
      )}

      {confirmDelete && (
        <div
          role="alertdialog"
          aria-label={t('deleteSection', { title })}
          className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          <span className="flex-1">{t('deleteConfirm', { title })}</span>
          <button
            type="button"
            className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-800"
            onClick={onDelete}
          >
            {t('deleteYes')}
          </button>
          <button
            type="button"
            className={SMALL_BUTTON}
            onClick={() => {
              setConfirmDelete(false);
            }}
          >
            {t('cancel')}
          </button>
        </div>
      )}

      <div className="mt-2 space-y-3 pl-6">
        {locked ? (
          <div className="space-y-2">
            <ul className="flex flex-wrap gap-1.5">
              {profileLanguages.map((language) => (
                <li key={language} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm">
                  {language}
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              <LockIcon />
              <span>
                {t('languagesLocked')}{' '}
                <Link href="/profile" className="font-medium underline">
                  {t('languagesChange')}
                </Link>
              </span>
            </p>
          </div>
        ) : (
          <>
            {section.blocks.map((block, blockIndex) => (
              <div key={block.id} className="group flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <BlockEditor
                    block={block}
                    onChange={(next, field) => {
                      setBlocks(replaceAt(section.blocks, blockIndex, next), field);
                    }}
                  />
                </div>
                {/* Moving blocks is rare: these show on hover or focus to keep the card calm. */}
                <div className="flex flex-col opacity-40 group-focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    disabled={blockIndex === 0}
                    aria-label={t('blockUp', { n: blockIndex + 1, title })}
                    title={t('up')}
                    onClick={() => {
                      setBlocks(move(section.blocks, blockIndex, blockIndex - 1), null);
                    }}
                  >
                    <UpIcon />
                  </button>
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    disabled={blockIndex === section.blocks.length - 1}
                    aria-label={t('blockDown', { n: blockIndex + 1, title })}
                    title={t('down')}
                    onClick={() => {
                      setBlocks(move(section.blocks, blockIndex, blockIndex + 1), null);
                    }}
                  >
                    <DownIcon />
                  </button>
                  <button
                    type="button"
                    className={`${ICON_BUTTON} hover:bg-red-50 hover:text-red-700`}
                    aria-label={t('blockDelete', { n: blockIndex + 1, title })}
                    title={t('delete')}
                    onClick={() => {
                      setBlocks(removeAt(section.blocks, blockIndex), null);
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>{t('add')}</span>
              {(['entry', 'bullets', 'paragraph'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={SMALL_BUTTON}
                  onClick={() => {
                    setBlocks([...section.blocks, newBlock(kind)], null);
                  }}
                >
                  + {t(`blockKind.${kind}`)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
