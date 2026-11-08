import type { BuilderBlock, BuilderEntry, BuilderProject } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { insertAt, joinSkill, move, newProject, removeAt, replaceAt, splitSkill } from '../docOps';
import { DownIcon, TrashIcon, UpIcon } from './icons';
import { ListEditor } from './ListEditor';
import { FIELD, ICON_BUTTON, SMALL_BUTTON } from './ui';

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

/**
 * One project of a job: collapsible, with its name, tech and bullets. The PDF sets its name in
 * bold under the job, with the tech after it in grey.
 */
function ProjectEditor({
  project,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  project: BuilderProject;
  index: number;
  count: number;
  onChange: (project: BuilderProject, field: string | null) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('Resume');
  const id = useId();
  const [open, setOpen] = useState(true);
  const label = project.name || t('projectUntitled');
  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={ICON_BUTTON}
          aria-expanded={open}
          aria-label={
            open ? t('collapseProject', { name: label }) : t('expandProject', { name: label })
          }
          title={open ? t('collapse') : t('expand')}
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          {open ? <DownIcon /> : <UpIcon />}
        </button>
        <span className="shrink-0 text-xs font-semibold text-slate-600">{t('project')}</span>
        {open ? (
          <input
            value={project.name}
            aria-label={t('projectName')}
            placeholder={t('projectNamePlaceholder')}
            onChange={(event) => {
              onChange({ ...project, name: event.target.value }, `${project.id}:name`);
            }}
            className={FIELD}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
            {label}
            <span className="ml-2 text-xs text-slate-500">
              {t('projectBullets', { count: project.bullets.filter((b) => b.trim()).length })}
            </span>
          </span>
        )}
        <button
          type="button"
          className={ICON_BUTTON}
          disabled={index === 0}
          aria-label={t('projectUp', { name: label })}
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
          aria-label={t('projectDown', { name: label })}
          title={t('down')}
          onClick={() => {
            onMove(index + 1);
          }}
        >
          <DownIcon />
        </button>
        <button
          type="button"
          className={`${ICON_BUTTON} hover:bg-red-50 hover:text-red-700`}
          aria-label={t('projectDelete', { name: label })}
          title={t('delete')}
          onClick={onRemove}
        >
          <TrashIcon />
        </button>
      </div>
      {open && (
        <>
          <div className="space-y-0.5">
            <label htmlFor={`${id}-tech`} className="block text-xs font-medium text-slate-600">
              {t('projectTech')}
            </label>
            <input
              id={`${id}-tech`}
              value={project.tech}
              placeholder={t('projectTechPlaceholder')}
              onChange={(event) => {
                onChange({ ...project, tech: event.target.value }, `${project.id}:tech`);
              }}
              className={FIELD}
            />
          </div>
          <ListEditor
            scope={`${project.id}:bullets`}
            items={project.bullets}
            itemLabel={t('bullet')}
            addLabel={t('addBullet')}
            onChange={(bullets, field) => {
              onChange({ ...project, bullets }, field);
            }}
          />
        </>
      )}
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
  const [open, setOpen] = useState(true);
  const projects = entry.projects ?? [];
  const summary = [entry.org || entry.title, entry.org ? entry.title : '', entry.meta]
    .filter(Boolean)
    .join(' · ');
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
  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        aria-label={t('expandEntry', { name: summary || t('untitled') })}
        className="flex w-full items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-left text-sm hover:bg-slate-50"
        onClick={() => {
          setOpen(true);
        }}
      >
        <UpIcon />
        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
          {summary || t('untitled')}
        </span>
        {projects.length > 0 && (
          <span className="shrink-0 text-xs text-slate-500">
            {t('projectCount', { count: projects.length })}
          </span>
        )}
      </button>
    );
  }
  const setProjects = (next: BuilderProject[], field: string | null) => {
    onChange({ ...entry, projects: next }, field);
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded
        aria-label={t('collapseEntry', { name: summary || t('untitled') })}
        title={t('collapse')}
        className={`${ICON_BUTTON} -mb-1`}
        onClick={() => {
          setOpen(false);
        }}
      >
        <DownIcon />
      </button>
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
      {projects.map((project, index) => (
        <ProjectEditor
          key={project.id}
          project={project}
          index={index}
          count={projects.length}
          onChange={(next, field) => {
            setProjects(replaceAt(projects, index, next), field);
          }}
          onMove={(to) => {
            setProjects(move(projects, index, to), null);
          }}
          onRemove={() => {
            setProjects(removeAt(projects, index), null);
          }}
        />
      ))}
      <button
        type="button"
        className={SMALL_BUTTON}
        onClick={() => {
          setProjects(insertAt(projects, projects.length, newProject()), null);
        }}
      >
        + {t('addProject')}
      </button>
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
