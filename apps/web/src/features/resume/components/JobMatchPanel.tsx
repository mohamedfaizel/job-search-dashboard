import type { BuilderDoc } from '@jobsearch/data';
import { useJobInsights, useMyProfile, useSetHaveTerm } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { DragEvent } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { achievementLines, docText, mentions } from '../docOps';
import { KEYWORD_TYPE } from '../keywordDrag';
import { GripIcon } from './icons';
import { SMALL_BUTTON } from './ui';

/** A chip you can drag onto a line of the resume. */
const dragKeyword = (term: string) => ({
  draggable: true,
  onDragStart: (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(KEYWORD_TYPE, term);
    event.dataTransfer.setData('text/plain', term);
  },
});

interface Props {
  jobId: string;
  /** The resume as it is in the editor now (not only as saved), so the chips follow your typing. */
  doc: BuilderDoc;
  onAddSkill: (term: string) => void;
  onAddBullet: (text: string) => void;
}

/**
 * What this job asks for, checked against this copy of your resume as you edit it: terms the
 * resume has, terms you have but the resume lacks (drag one onto a line, or add it to Skills),
 * and terms you do not have (tick "I have this" only when it is true). The Fit % is the saved
 * copy's score. Your achievements bank is the list of true lines to add.
 */
export function JobMatchPanel({ jobId, doc, onAddSkill, onAddBullet }: Props) {
  const t = useTranslations('Resume.match');
  const errorText = useErrorText();
  const insights = useJobInsights(jobId);
  const profile = useMyProfile();
  const setHave = useSetHaveTerm();

  if (insights.isPending) return <p className="text-sm text-slate-500">{t('loading')}</p>;
  if (insights.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(insights.error)}
      </p>
    );
  }

  const data = insights.data;
  const keywordTerms = new Set(data.keywords.map((k) => k.term));
  const seen = new Set<string>();
  const terms = [...data.skills, ...data.keywords].filter((c) => {
    if (seen.has(c.term)) return false;
    seen.add(c.term);
    return true;
  });
  const text = docText(doc);
  const state = terms.map((c) => ({ ...c, inCopy: mentions(text, c.term) }));
  const have = state.filter((c) => c.inCopy);
  const ready = state.filter((c) => !c.inCopy && c.youHave);
  const missing = state.filter((c) => !c.inCopy && !c.youHave);
  const score = data.jobResume?.score ?? data.score;
  const achievements = achievementLines(profile.data?.achievements ?? '');

  return (
    <section
      aria-label={t('title')}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-sm font-semibold text-slate-900">{t('title')}</h2>
        <span
          role="status"
          aria-label={t('fit')}
          className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold tabular-nums text-white"
        >
          {score === null ? '–' : `${String(score)}%`}
        </span>
        <span className="text-xs text-slate-600">
          {t('covered', { have: have.length + ready.length, total: state.length })}
        </span>
      </div>
      <p className="text-xs text-slate-500">{t('fitHint')}</p>

      {setHave.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(setHave.error)}
        </p>
      )}

      {state.length === 0 && <p className="text-sm text-slate-600">{t('noTerms')}</p>}

      {missing.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            {t('missing')}
          </h3>
          <p className="text-xs text-slate-500">{t('missingHint')}</p>
          <ul className="flex flex-wrap gap-1.5">
            {missing.map((c) => (
              <li
                key={c.term}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 py-0.5 pl-2.5 pr-1 text-sm text-amber-950"
              >
                {c.term}
                <button
                  type="button"
                  disabled={setHave.isPending}
                  title={t('iHave')}
                  aria-label={t('iHaveTerm', { term: c.term })}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  onClick={() => {
                    setHave.mutate({
                      jobId,
                      term: c.term,
                      have: true,
                      keyword: keywordTerms.has(c.term),
                    });
                  }}
                >
                  ✓
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ready.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-800">
            {t('ready')}
          </h3>
          <p className="text-xs text-slate-500">{t('readyHint')}</p>
          <ul className="flex flex-wrap gap-1.5">
            {ready.map((c) => (
              <li
                key={c.term}
                {...dragKeyword(c.term)}
                className="inline-flex cursor-grab items-center gap-0.5 rounded-full bg-sky-100 py-0.5 pl-1 pr-1 text-sm text-sky-950 active:cursor-grabbing"
              >
                <span className="text-sky-700" aria-hidden>
                  <GripIcon />
                </span>
                {c.term}
                <button
                  type="button"
                  title={t('addToSkills')}
                  aria-label={t('addTermToSkills', { term: c.term })}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full font-semibold text-sky-900 hover:bg-sky-200"
                  onClick={() => {
                    onAddSkill(c.term);
                  }}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {have.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            {t('inResume')}
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {have.map((c) => (
              <li
                key={c.term}
                className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm text-emerald-950"
              >
                {c.term}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          {t('achievements')}
        </h3>
        {achievements.length === 0 ? (
          <p className="text-xs text-slate-500">{t('noAchievements')}</p>
        ) : (
          <>
            <p className="text-xs text-slate-500">{t('achievementsHint')}</p>
            <ul className="space-y-1">
              {achievements.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-slate-800">
                  <span className="min-w-0 flex-1">{line}</span>
                  <button
                    type="button"
                    className={SMALL_BUTTON}
                    aria-label={t('addBulletLabel', { line })}
                    onClick={() => {
                      onAddBullet(line);
                    }}
                  >
                    + {t('addBullet')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
