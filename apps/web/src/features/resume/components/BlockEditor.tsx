import type { BuilderBlock, BuilderEntry } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { joinSkill, splitSkill } from '../docOps';
import { ListEditor } from './ListEditor';
import { FIELD } from './ui';

interface Props {
  block: BuilderBlock;
  onChange: (block: BuilderBlock, field: string | null) => void;
  /** In a Skills section a paragraph is a row: a label and its list. */
  skills?: boolean;
}

/** One block of a section: a paragraph, a bullet list, or a job/degree/project. */
export function BlockEditor({ block, onChange, skills = false }: Props) {
  const t = useTranslations('Resume');
  if (block.kind === 'paragraph' && skills) {
    return (
      <SkillRow
        text={block.text}
        onChange={(text) => {
          onChange({ ...block, text }, `${block.id}:text`);
        }}
      />
    );
  }
  if (block.kind === 'paragraph') {
    return (
      <textarea
        rows={3}
        value={block.text}
        aria-label={t('paragraph')}
        placeholder={t('paragraphPlaceholder')}
        onChange={(event) => {
          onChange({ ...block, text: event.target.value }, `${block.id}:text`);
        }}
        className={`${FIELD} min-h-16 resize-y`}
      />
    );
  }
  if (block.kind === 'bullets') {
    return (
      <ListEditor
        scope={block.id}
        items={block.items}
        itemLabel={t('bullet')}
        addLabel={t('addBullet')}
        onChange={(items, field) => {
          onChange({ ...block, items }, field);
        }}
      />
    );
  }
  return <EntryEditor entry={block} onChange={onChange} />;
}

/**
 * A skills line as two boxes, "Frontend" and "React, Vue 3": saved as "Frontend: React, Vue 3",
 * which the PDF sets as an aligned index. The boxes keep their own text while you type, so a
 * colon in the list never moves the label.
 */
function SkillRow({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const t = useTranslations('Resume');
  const [row, setRow] = useState(() => splitSkill(text));
  const change = (next: { label: string; list: string }) => {
    setRow(next);
    onChange(joinSkill(next.label, next.list));
  };
  return (
    <div className="grid gap-1.5 sm:grid-cols-[9rem_1fr]">
      <input
        value={row.label}
        aria-label={t('skillLabel')}
        placeholder={t('skillLabelPlaceholder')}
        onChange={(event) => {
          change({ ...row, label: event.target.value });
        }}
        className={`${FIELD} font-semibold`}
      />
      <textarea
        rows={1}
        value={row.list}
        aria-label={t('skillList')}
        placeholder={t('skillListPlaceholder')}
        onChange={(event) => {
          change({ ...row, list: event.target.value });
        }}
        className={`${FIELD} resize-none`}
      />
    </div>
  );
}

function EntryEditor({
  entry,
  onChange,
}: {
  entry: BuilderEntry;
  onChange: (block: BuilderEntry, field: string | null) => void;
}) {
  const t = useTranslations('Resume');
  const id = useId();
  const input = (key: 'title' | 'org' | 'meta', label: string, placeholder: string) => (
    <div className="min-w-0 space-y-0.5">
      <label htmlFor={`${id}-${key}`} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        value={entry[key]}
        placeholder={placeholder}
        onChange={(event) => {
          onChange({ ...entry, [key]: event.target.value }, `${entry.id}:${key}`);
        }}
        className={FIELD}
      />
    </div>
  );
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {input('title', t('entryTitle'), t('entryTitlePlaceholder'))}
        {input('org', t('entryOrg'), t('entryOrgPlaceholder'))}
      </div>
      {input('meta', t('entryMeta'), t('entryMetaPlaceholder'))}
      <ListEditor
        scope={`${entry.id}:bullets`}
        items={entry.bullets}
        itemLabel={t('bullet')}
        addLabel={t('addBullet')}
        onChange={(bullets, field) => {
          onChange({ ...entry, bullets }, field);
        }}
      />
      {entry.lines.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-600">{t('entryLines')}</p>
          <ListEditor
            scope={`${entry.id}:lines`}
            items={entry.lines}
            itemLabel={t('line')}
            addLabel={t('addLine')}
            onChange={(lines, field) => {
              onChange({ ...entry, lines }, field);
            }}
          />
        </div>
      )}
    </div>
  );
}
