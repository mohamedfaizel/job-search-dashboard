import type { QueueKitsInput } from '@jobsearch/data';
import { useMyApiKeys, useQueueKitRun, useWriteApplyQueueKits } from '@jobsearch/data';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { InfoTip } from '../../../components/InfoTip';
import { useErrorText } from '../../../i18n/useErrorText';

/** Kept in this browser only: which parts the AI writes, and the master-resume rule. */
const SETTINGS_KEY = 'jobsearch.queueKits';
const DEFAULTS: QueueKitsInput = { resume: true, cover: true, answers: true, masterMin: 90 };
const PARTS = [
  ['resume', 'partResume'],
  ['cover', 'partCover'],
  ['answers', 'partAnswers'],
] as const;

function loadSettings(): QueueKitsInput {
  try {
    const saved = window.localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULTS, ...(JSON.parse(saved) as Partial<QueueKitsInput>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(settings: QueueKitsInput): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private window or blocked storage: the settings last until the page closes.
  }
}

/**
 * "Write with my key": the server writes the kits of every queued job with no reply yet, with
 * your own Claude or OpenAI key. It costs API money; the copy-and-paste prompt next to it is free.
 */
export function WriteWithKey({
  waiting,
  started,
  onStart,
}: {
  /** Queued jobs with no reply yet. With none, only the last run's result shows. */
  waiting: number;
  /** You clicked it while this window was open: its result shows. */
  started: boolean;
  onStart: () => void;
}) {
  const t = useTranslations('Jobs.queue');
  const format = useFormatter();
  const errorText = useErrorText();
  const keys = useMyApiKeys();
  const run = useQueueKitRun();
  const write = useWriteApplyQueueKits();
  const [settings, setSettings] = useState<QueueKitsInput>(DEFAULTS);
  const [showSettings, setShowSettings] = useState(false);
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setSettings(loadSettings());
  }, []);

  const hasKey = (keys.data ?? []).some((k) => k.kind === 'ANTHROPIC' || k.kind === 'OPENAI');
  const noKey = keys.isSuccess && !hasKey;
  const writing = run?.running ? run : null;
  const change = (patch: Partial<QueueKitsInput>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };
  const on = PARTS.filter(([key]) => settings[key]);

  const start = () => {
    onStart();
    write.mutate(settings);
  };

  const result = started && run && !run.running ? run : null;
  const cost =
    result?.costCents != null && result.currency
      ? format.number(result.costCents / 100, { style: 'currency', currency: result.currency })
      : null;

  return (
    <div className={waiting > 0 ? 'space-y-2 border-t border-amber-800/20 pt-2' : 'space-y-2'}>
      {waiting > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={noKey || !!writing || write.isPending}
            onClick={start}
            aria-describedby="write-with-key-tip"
            className="rounded-md bg-neutral-900 px-3 py-1.5 font-semibold text-amber-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            {writing || write.isPending ? (
              t('keyWriting')
            ) : (
              <>
                <span aria-hidden="true">✦ </span>
                {t('keyButton')}
              </>
            )}
          </button>
          <InfoTip label={t('keyAbout')} text={t('keyHint')} />
          <span id="write-with-key-tip" className="sr-only">
            {t('keyHint')}
          </span>
          <button
            type="button"
            aria-expanded={showSettings}
            onClick={() => {
              setShowSettings((open) => !open);
            }}
            className="ml-auto text-xs text-amber-900 hover:underline"
          >
            {t('keySettings')}
          </button>
        </div>
      )}

      {waiting > 0 && showSettings && (
        <div className="space-y-1.5 text-xs">
          <div
            role="group"
            aria-label={t('keyWrites')}
            className="flex flex-wrap items-center gap-1"
          >
            <span aria-hidden>{t('keyWrites')}</span>
            {PARTS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={settings[key]}
                // At least one part stays on.
                disabled={settings[key] && on.length === 1}
                onClick={() => {
                  change({ [key]: !settings[key] });
                }}
                className={`rounded-full border px-2 py-0.5 text-[11px] disabled:cursor-not-allowed ${
                  settings[key]
                    ? 'border-neutral-900 bg-neutral-900 text-amber-300'
                    : 'border-amber-800/50 text-amber-900'
                }`}
              >
                {settings[key] && <span aria-hidden>✓ </span>}
                {t(label)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={settings.masterMin !== null}
              onChange={(event) => {
                change({ masterMin: event.target.checked ? 90 : null });
              }}
              className="accent-neutral-900"
            />
            {t('keyMaster', { score: settings.masterMin ?? 90 })}
            <InfoTip label={t('keyMasterAbout')} text={t('keyMasterHint')} />
          </label>
        </div>
      )}

      {waiting > 0 && noKey && (
        <p role="alert" className="text-xs text-red-700">
          {t('keyNoKey')}{' '}
          <Link href="/settings?tab=keys" className="font-medium underline">
            {t('keyAddKey')}
          </Link>
        </p>
      )}

      {writing && (
        <div role="status" className="space-y-1">
          <p className="text-xs">
            {t('keyProgress', {
              done: Math.min(writing.done + 1, Math.max(writing.total, 1)),
              total: Math.max(writing.total, 1),
            })}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-amber-900/15">
            <div
              className="h-full bg-amber-400 transition-all"
              style={{
                width: `${String(Math.round((writing.done / Math.max(writing.total, 1)) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {result && result.written > 0 && (
        <div
          role="status"
          className="space-y-0.5 rounded-md bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800"
        >
          <p className="font-semibold">✓ {t('keyDone', { count: result.written })}</p>
          {(result.usedMaster ?? 0) > 0 && (
            <p>{t('keyUsedMaster', { count: result.usedMaster ?? 0 })}</p>
          )}
          {(result.belowTarget ?? 0) > 0 && (
            <p>{t('keyBelowTarget', { count: result.belowTarget ?? 0 })}</p>
          )}
          {result.failed > 0 && <p>{t('keySomeFailed', { count: result.failed })}</p>}
          <p className="flex justify-between gap-2 border-t border-dashed border-emerald-800/30 pt-1 tabular-nums">
            <span>{cost ? t('keyCost', { cost }) : t('keyNoCost')}</span>
            {(result.savedPercent ?? 0) > 0 && (
              <b>{t('keySaved', { percent: result.savedPercent ?? 0 })}</b>
            )}
          </p>
        </div>
      )}

      {result?.reason && (
        <p role="alert" className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">
          {result.reason === 'NO_KEY' || result.reason === 'KEY_REFUSED' ? (
            <>
              {t(result.reason === 'NO_KEY' ? 'keyNoKey' : 'keyRefused')}{' '}
              <Link href="/settings?tab=keys" className="font-medium underline">
                {t('keyCheck')}
              </Link>
            </>
          ) : result.reason === 'NO_RESUME' ? (
            <>
              {t('keyNoResume')}{' '}
              <Link href="/resume" className="font-medium underline">
                {t('keyResumePage')}
              </Link>
            </>
          ) : (
            t('keyNoneWritten')
          )}
        </p>
      )}

      {write.isError && (
        <p role="alert" className="text-xs text-red-700">
          {t('keyError', { error: errorText(write.error) })}
        </p>
      )}
    </div>
  );
}
