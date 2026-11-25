import { useRemoveResumeSkill, useSetHaveTerm } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

const ICON_BUTTON =
  'inline-grid h-7 w-7 place-items-center rounded-md border border-slate-300 bg-white text-sm font-bold hover:bg-slate-50 disabled:opacity-50';

/**
 * Apply step 3: the skills the tailored resume names that are not on your My skills list, marked
 * gold in the preview. ✓ keeps one (it goes on My skills, so it is not marked again); ✕ takes it
 * out of the resume's Skills section and scores it again. Nothing shows when there are none.
 */
export function AddedSkills({ jobId, skills }: { jobId: string; skills: string[] }) {
  const t = useTranslations('Jobs.added');
  const errorText = useErrorText();
  const keep = useSetHaveTerm();
  const remove = useRemoveResumeSkill();
  // Removed from the Skills section, but still named in a sentence: you edit that line.
  const [inSentence, setInSentence] = useState<string[]>([]);
  if (skills.length === 0) return null;
  const busy = keep.isPending || remove.isPending;

  return (
    <section
      aria-label={t('label')}
      className="space-y-2 rounded-xl border border-flag-gold/60 bg-amber-50/60 px-3 py-2.5"
    >
      <h3 className="text-sm font-semibold text-slate-900">
        {t('title', { count: skills.length })}
      </h3>
      <p className="text-xs text-slate-700">{t('intro')}</p>
      <ul className="divide-y divide-amber-200">
        {skills.map((skill) => (
          <li key={skill} aria-label={skill} className="flex items-center gap-2 py-1.5 text-sm">
            <mark className="rounded-sm border-b-2 border-flag-gold bg-amber-100 px-1 text-slate-900">
              {skill}
            </mark>
            <span className="min-w-0 flex-1 text-xs text-slate-600">
              {inSentence.includes(skill) ? t('inSentence') : t('notMine')}
            </span>
            <button
              type="button"
              aria-label={t('keep', { skill })}
              title={t('keepHint')}
              disabled={busy}
              className={`${ICON_BUTTON} text-emerald-700`}
              onClick={() => {
                keep.mutate({ jobId, term: skill, have: true });
              }}
            >
              ✓
            </button>
            <button
              type="button"
              aria-label={t('remove', { skill })}
              title={t('removeHint')}
              disabled={busy}
              className={`${ICON_BUTTON} text-red-700`}
              onClick={() => {
                remove.mutate(
                  { jobId, skill },
                  {
                    onSuccess: (insights) => {
                      if (insights.jobResume?.addedSkills.includes(skill)) {
                        setInSentence((list) => [...list, skill]);
                      }
                    },
                  },
                );
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {(keep.error ?? remove.error) && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(keep.error ?? remove.error)}
        </p>
      )}
    </section>
  );
}
