'use client';

import type { Profile } from '@jobsearch/data';
import { useFinishOnboarding, useMe, useMyApiKeys, useMyProfile } from '@jobsearch/data';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../i18n/useErrorText';
import { ResumeUpload } from '../resume/components/ResumeUpload';
import type { Step } from '../resume/components/Steps';
import { StepBar } from '../resume/components/Steps';
import { KeyCard } from '../settings/components/ApiKeys';

type WelcomeStep = 'key' | 'resume' | 'done';
const STEPS: WelcomeStep[] = ['key', 'resume', 'done'];

const NEXT =
  'rounded-md bg-brand-400 px-4 py-2 text-sm font-semibold text-black hover:bg-brand-300 disabled:opacity-50';
const PLAIN =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

/** The My profile > Personal fields an upload can fill, as "Name", "Phone"... */
const FILLED_FIELDS = [
  ['firstName', 'name'],
  ['headline', 'headline'],
  ['phone', 'phone'],
  ['linkedinUrl', 'linkedin'],
  ['githubUrl', 'github'],
  ['websiteUrl', 'website'],
] as const;

/**
 * The first time you log in: 1. your job data (JobHunter) key, so imports work; 2. your resume,
 * which also fills My profile > Personal where it is empty; 3. done. You can skip any step, and
 * finishing or skipping means it never shows again.
 */
export function WelcomePage() {
  const t = useTranslations('Welcome');
  const tKeys = useTranslations('Settings.keys');
  const errorText = useErrorText();
  const router = useRouter();
  const { data: me } = useMe();
  const keys = useMyApiKeys();
  const profile = useMyProfile();
  const finish = useFinishOnboarding();
  const [step, setStep] = useState<WelcomeStep>('key');
  const [uploaded, setUploaded] = useState<Profile | null>(null);

  const steps: Step<WelcomeStep>[] = STEPS.map((id) => ({ id, label: t(`steps.${id}`) }));
  const key = keys.data?.find((k) => k.kind === 'JOBHUNTER') ?? null;
  const resume = uploaded ?? profile.data ?? null;
  const done = (href: string) => {
    finish.mutate(undefined, {
      onSuccess: () => {
        router.replace(href);
      },
    });
  };

  return (
    <section aria-labelledby="welcome-title" className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 id="welcome-title" className="text-xl font-semibold text-slate-900">
            {t('title', { name: me?.name ?? '' })}
          </h1>
          <p className="text-sm text-slate-600">{t('intro')}</p>
        </div>
        <button
          type="button"
          disabled={finish.isPending}
          onClick={() => {
            done('/jobs');
          }}
          className="text-sm text-slate-500 underline hover:text-slate-800"
        >
          {t('skipAll')}
        </button>
      </div>
      <StepBar
        steps={steps}
        current={step}
        onSelect={setStep}
        // A skipped step gets no ✓.
        isDone={(id) => (id === 'key' ? !!key : id === 'resume' && !!resume?.resumeFileName)}
      />

      {step === 'key' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">{t('key.title')}</h2>
            <p className="text-sm text-slate-600">{t('key.intro')}</p>
            <p className="text-sm text-slate-600">
              {t('key.where')}{' '}
              <a
                href="https://jobspipe.dev"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-slate-900 underline"
              >
                {t('key.whereLink')}
              </a>
            </p>
          </div>
          {keys.isPending ? (
            <p className="text-sm text-slate-500">{t('loading')}</p>
          ) : keys.isError ? (
            <p role="alert" className="text-sm text-red-700">
              {errorText(keys.error)}
            </p>
          ) : (
            <KeyCard
              kind="JOBHUNTER"
              name={tKeys('jobhunter.name')}
              hint={tKeys('jobhunter.hint')}
              testHint={tKeys('jobhunter.testHint')}
              paste={tKeys('paste')}
              confirmDelete={tKeys('confirmDelete')}
              saved={key}
            />
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={key ? NEXT : PLAIN}
              onClick={() => {
                setStep('resume');
              }}
            >
              {key ? t('next') : t('skip')}
            </button>
          </div>
        </div>
      )}

      {step === 'resume' && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">{t('resume.title')}</h2>
            <p className="text-sm text-slate-600">{t('resume.intro')}</p>
          </div>
          <ResumeUpload fileName={resume?.resumeFileName ?? null} onUploaded={setUploaded} />
          {uploaded && <Filled profile={uploaded} />}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              className={PLAIN}
              onClick={() => {
                setStep('key');
              }}
            >
              ‹ {t('back')}
            </button>
            <button
              type="button"
              className={resume?.resumeFileName ? NEXT : PLAIN}
              onClick={() => {
                setStep('done');
              }}
            >
              {resume?.resumeFileName ? t('next') : t('skip')}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">{t('done.title')}</h2>
          <ul className="space-y-1.5 text-sm">
            <Check ok={!!key} text={key ? t('done.key') : t('done.noKey')} />
            <Check
              ok={!!resume?.resumeFileName}
              text={resume?.resumeFileName ? t('done.resume') : t('done.noResume')}
            />
          </ul>
          <p className="text-sm text-slate-600">{t('done.later')}</p>
          {finish.isError && (
            <p role="alert" className="text-sm text-red-700">
              {errorText(finish.error)}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={finish.isPending}
              className={PLAIN}
              onClick={() => {
                done('/profile');
              }}
            >
              {t('done.profile')}
            </button>
            <button
              type="button"
              disabled={finish.isPending}
              className={NEXT}
              onClick={() => {
                done(key ? '/jobs/add' : '/jobs');
              }}
            >
              {key ? t('done.addJobs') : t('done.jobs')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className={ok ? 'text-emerald-700' : 'text-slate-400'}>
        {ok ? '✓' : '○'}
      </span>
      <span className={ok ? 'text-slate-900' : 'text-slate-600'}>{text}</span>
    </li>
  );
}

/** What the upload put into My profile > Personal. */
function Filled({ profile }: { profile: Profile }) {
  const t = useTranslations('Welcome.resume');
  const found = FILLED_FIELDS.filter(([field]) => !!profile[field]);
  if (!found.length) return null;
  return (
    <div role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
      <p className="font-medium">{t('filled')}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {found.map(([field, label]) => (
          <li key={field} className="rounded-full bg-white px-2.5 py-0.5 ring-1 ring-emerald-200">
            {t(`fields.${label}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
