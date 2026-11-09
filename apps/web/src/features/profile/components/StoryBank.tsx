'use client';

import type { Story, StoryInput } from '@jobsearch/data';
import { useDeleteStory, useSaveStory, useStories } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { PencilIcon, TickIcon, TrashIcon, XIcon } from '../../resume/components/icons';
import { ICON_BUTTON } from '../../resume/components/ui';
import { inputClass } from './Field';

/** The STAR parts, in order, and the optional reflection. */
const PARTS = ['situation', 'task', 'action', 'result', 'reflection'] as const;
type Part = (typeof PARTS)[number];

const EMPTY: StoryInput = {
  title: '',
  situation: '',
  task: '',
  action: '',
  result: '',
  reflection: '',
  tags: [],
};

/** "SQL, leadership , sql" → ["SQL", "leadership"]. */
export const splitTags = (text: string) => [
  ...new Map(
    text
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => [tag.toLowerCase(), tag]),
  ).values(),
];

/**
 * My profile › Story bank: true stories for interviews, in STAR form (situation, task, action,
 * result). Interview prep gives Claude the ones that fit each job, for the behavioural answers.
 */
export function StoryBank() {
  const t = useTranslations('Profile.stories');
  const errorText = useErrorText();
  const stories = useStories();
  const [adding, setAdding] = useState(false);

  return (
    <section
      aria-labelledby="stories-heading"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="stories-heading" className="text-lg font-semibold text-slate-900">
            {t('title')}
          </h2>
          <p className="text-sm text-slate-600">{t('intro')}</p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
            }}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            + {t('add')}
          </button>
        )}
      </div>
      {adding && (
        <StoryForm
          initial={EMPTY}
          onDone={() => {
            setAdding(false);
          }}
        />
      )}
      {stories.isPending && <p className="text-sm text-slate-500">{t('loading')}</p>}
      {stories.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(stories.error)}
        </p>
      )}
      {stories.data?.length === 0 && !adding && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{t('empty')}</p>
      )}
      {stories.data && stories.data.length > 0 && (
        <ul className="space-y-3">
          {stories.data.map((story) => (
            <StoryRow key={story.id} story={story} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One story: its title and tags, the STAR parts when opened, and Edit / Delete. */
function StoryRow({ story }: { story: Story }) {
  const t = useTranslations('Profile.stories');
  const errorText = useErrorText();
  const remove = useDeleteStory();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (editing) {
    return (
      <li>
        <StoryForm
          initial={story}
          onDone={() => {
            setEditing(false);
          }}
        />
      </li>
    );
  }
  return (
    <li className="rounded-lg border border-slate-200 text-sm">
      <div className="flex items-start gap-2 px-3 py-2">
        <details className="group min-w-0 flex-1">
          <summary className="cursor-pointer list-none">
            <span className="font-medium text-slate-900">{story.title}</span>
            {story.tags.length > 0 && (
              <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                {story.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                  >
                    {tag}
                  </span>
                ))}
              </span>
            )}
          </summary>
          <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[7rem_1fr]">
            {PARTS.filter((part) => story[part].trim()).map((part) => (
              <div key={part} className="contents">
                <dt className="font-medium text-slate-500">{t(`parts.${part}`)}</dt>
                <dd className="whitespace-pre-line text-slate-800">{story[part]}</dd>
              </div>
            ))}
          </dl>
        </details>
        {confirm ? (
          <span role="group" aria-label={t('deleteConfirm')} className="flex items-center gap-1">
            <span className="text-xs text-red-800">{t('deleteConfirm')}</span>
            <button
              type="button"
              aria-label={t('deleteYes', { title: story.title })}
              title={t('deleteYesShort')}
              disabled={remove.isPending}
              onClick={() => {
                remove.mutate(story.id);
              }}
              className={`${ICON_BUTTON} text-red-700 hover:bg-red-50 hover:text-red-800`}
            >
              <TickIcon />
            </button>
            <button
              type="button"
              aria-label={t('cancel')}
              title={t('cancel')}
              onClick={() => {
                setConfirm(false);
              }}
              className={ICON_BUTTON}
            >
              <XIcon />
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t('editFor', { title: story.title })}
              title={t('edit')}
              onClick={() => {
                setEditing(true);
              }}
              className={ICON_BUTTON}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              aria-label={t('deleteFor', { title: story.title })}
              title={t('delete')}
              onClick={() => {
                setConfirm(true);
              }}
              className={`${ICON_BUTTON} hover:bg-red-50 hover:text-red-700`}
            >
              <TrashIcon />
            </button>
          </span>
        )}
      </div>
      {remove.isError && (
        <p role="alert" className="px-3 pb-2 text-xs text-red-700">
          {errorText(remove.error)}
        </p>
      )}
    </li>
  );
}

/** Adds a story, or changes one: a title, the four STAR parts, a reflection and tags. */
function StoryForm({ initial, onDone }: { initial: StoryInput; onDone: () => void }) {
  const t = useTranslations('Profile.stories');
  const errorText = useErrorText();
  const save = useSaveStory();
  const id = useId();
  const [story, setStory] = useState<StoryInput>(initial);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const set = (part: Part | 'title', value: string) => {
    setStory((was) => ({ ...was, [part]: value }));
  };

  return (
    <form
      aria-label={initial.id ? t('editFor', { title: initial.title }) : t('add')}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ ...story, tags: splitTags(tags) }, { onSuccess: onDone });
      }}
      className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/40 p-3"
    >
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">{t('storyTitle')}</span>
        <input
          required
          maxLength={120}
          value={story.title}
          placeholder={t('titleExample')}
          onChange={(event) => {
            set('title', event.target.value);
          }}
          className={inputClass}
        />
      </label>
      {PARTS.map((part) => (
        <label key={part} className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">
            {t(`parts.${part}`)}
            <span className="ml-2 font-normal text-slate-500">{t(`hints.${part}`)}</span>
          </span>
          <textarea
            rows={2}
            maxLength={2000}
            value={story[part]}
            onChange={(event) => {
              set(part, event.target.value);
            }}
            className={inputClass}
          />
        </label>
      ))}
      <label className="block space-y-1 text-sm" htmlFor={`${id}-tags`}>
        <span className="font-medium text-slate-700">{t('tags')}</span>
        <input
          id={`${id}-tags`}
          value={tags}
          placeholder={t('tagsExample')}
          onChange={(event) => {
            setTags(event.target.value);
          }}
          className={inputClass}
        />
      </label>
      {save.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(save.error)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {save.isPending ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
