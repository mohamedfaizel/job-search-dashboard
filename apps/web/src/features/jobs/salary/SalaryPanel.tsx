import type { Job, SalaryResearch } from '@jobsearch/data';
import { useSalaryResearch } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { useAiChat } from '../../../lib/ai-chat';
import { AiTag } from '../components/AiLabels';
import { CopyButton } from '../components/CopyButton';
import { CopyText } from '../components/CopyText';
import type { ScriptId } from './scripts';
import { money, salaryScripts } from './scripts';

const SCRIPTS: ScriptId[] = ['expectation', 'counter', 'extras'];
const INPUT =
  'h-9 w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none';

/** "76000", "76.000", "76k" → 76000; empty or unreadable → null. */
export function parseAmount(text: string): number | null {
  const clean = text
    .trim()
    .toLowerCase()
    .replaceAll(/[\s.,'€$]/g, '');
  if (!clean) return null;
  const k = clean.endsWith('k');
  const n = Number(k ? clean.slice(0, -1) : clean);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(k ? n * 1000 : n);
}

/** Where a value sits on the bar, in percent. */
const at = (value: number, min: number, max: number) =>
  `${Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))}%`;

/** Low to high band, the typical (median) tick, and this ad's own range. */
function RangeBar({ data, language }: { data: SalaryResearch; language: string }) {
  const t = useTranslations('Jobs.salary');
  const values = [data.low, data.median, data.high, data.jobMin, data.jobMax].filter(
    (v): v is number => v !== null,
  );
  if (data.low === null || data.high === null || data.median === null) return null;
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.1;
  const m = (n: number) => money(n, data.currency, language);
  const jobFrom = data.jobMin ?? data.jobMax;
  const jobTo = data.jobMax ?? data.jobMin;

  return (
    <div className="space-y-2">
      <div className="relative h-10" aria-hidden="true">
        <div className="absolute top-4 h-2 w-full rounded-full bg-slate-100" />
        <div
          className="absolute top-4 h-2 rounded-full bg-emerald-200"
          style={{ left: at(data.low, min, max), right: `calc(100% - ${at(data.high, min, max)})` }}
        />
        <div
          className="absolute top-2.5 h-5 w-1 -translate-x-1/2 rounded bg-emerald-700"
          style={{ left: at(data.median, min, max) }}
        />
        {jobFrom !== null && jobTo !== null && (
          <div
            className="absolute top-8 h-1.5 min-w-1.5 rounded-full bg-brand-600"
            style={{ left: at(jobFrom, min, max), right: `calc(100% - ${at(jobTo, min, max)})` }}
          />
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        {(['low', 'median', 'high'] as const).map((key) => (
          <div key={key} className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">{t(key)}</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">{m(data[key] ?? 0)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The Salary tab: what similar jobs pay (from the jobs we already have, no AI), a number to ask
 * for, scripts to copy for the salary question, a counter-offer and extras, and a prompt for
 * Claude when you want scripts made for you.
 */
export function SalaryPanel({ job, active }: { job: Job; active: boolean }) {
  const t = useTranslations('Jobs.salary');
  const errorText = useErrorText();
  const chat = useAiChat();
  const { data, error, isPending } = useSalaryResearch(job.id, { enabled: active });
  const [askText, setAskText] = useState<string | null>(null);
  const [offerText, setOfferText] = useState('');

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {t('error', { error: errorText(error) })}
      </p>
    );
  }
  if (isPending) return <p className="text-sm text-slate-500">{t('loading')}</p>;

  const language = job.language === 'de' ? 'de' : 'en';
  const ask = parseAmount(askText ?? (data.ask === null ? '' : String(data.ask)));
  const offer = parseAmount(offerText);
  const scripts =
    ask === null
      ? null
      : salaryScripts({
          language,
          currency: data.currency,
          title: job.title,
          company: job.company.name,
          ask,
          offer,
        });

  return (
    <div className="space-y-6">
      <section aria-labelledby="salary-market" className="space-y-3">
        <h3 id="salary-market" className="text-sm font-semibold text-slate-900">
          {t('marketTitle')}
        </h3>
        {data.basis === 'NONE' ? (
          <p className="text-sm text-slate-600">{t('noData')}</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {t(data.basis === 'TITLE' ? 'basisTitle' : 'basisFunction', {
                count: data.sampleSize,
              })}
              {data.estimatedCount > 0 && ` ${t('estimated', { count: data.estimatedCount })}`}
            </p>
            <RangeBar data={data} language={language} />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-4 rounded-full bg-emerald-200" />
                {t('legendRange')}
              </span>
              {(data.jobMin !== null || data.jobMax !== null) && (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-1.5 w-4 rounded-full bg-brand-600" />
                  {t('legendAd', {
                    range: [data.jobMin, data.jobMax]
                      .filter((v): v is number => v !== null)
                      .map((v) => money(v, data.currency, language))
                      .join(' – '),
                  })}
                </span>
              )}
            </p>
            {data.examples.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-600">{t('examples')}</summary>
                <ul className="mt-1 space-y-0.5 text-slate-700">
                  {data.examples.map((e) => (
                    <li key={e.jobId}>
                      {e.title} · {e.company} ·{' '}
                      {[e.min, e.max]
                        .filter((v): v is number => v !== null)
                        .map((v) => money(v, data.currency, language))
                        .join(' – ')}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="salary-scripts" className="space-y-3">
        <h3 id="salary-scripts" className="text-sm font-semibold text-slate-900">
          {t('scriptsTitle')}
        </h3>
        <div className="flex flex-wrap gap-4">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block">{t('askLabel', { currency: data.currency })}</span>
            <input
              inputMode="numeric"
              value={askText ?? (data.ask === null ? '' : String(data.ask))}
              onChange={(e) => {
                setAskText(e.target.value);
              }}
              className={INPUT}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block">{t('offerLabel', { currency: data.currency })}</span>
            <input
              inputMode="numeric"
              value={offerText}
              onChange={(e) => {
                setOfferText(e.target.value);
              }}
              className={INPUT}
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          {t('askHint')}
          {data.expectation.trim() && ` ${t('yourExpectation', { text: data.expectation.trim() })}`}
        </p>
        {scripts === null ? (
          <p className="text-sm text-slate-600">{t('needAsk')}</p>
        ) : (
          <ul className="space-y-3">
            {SCRIPTS.map((id) => (
              <li key={id} className="space-y-1.5 rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-slate-900">{t(`scripts.${id}`)}</h4>
                  <CopyButton text={scripts[id]} />
                </div>
                <p lang={language} className="text-sm text-slate-700">
                  {scripts[id]}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="salary-ai" className="space-y-2">
        <h3 id="salary-ai" className="text-sm font-semibold text-slate-900">
          {t('aiTitle')}
        </h3>
        <CopyText
          label={t('aiCopy')}
          text={data.prompt}
          copiedHint={t('aiCopied')}
          boxLabel={t('aiBox')}
          openUrl={chat.url}
          icon={<AiTag kind="chat" />}
        >
          <span className="text-sm text-slate-600">{t('aiHint')}</span>
        </CopyText>
      </section>
    </div>
  );
}
