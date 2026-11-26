import type { AutopilotRules, SavedSearch, ScheduleFrequency } from '@jobsearch/data';
import {
  SCHEDULE_FREQUENCIES,
  useKitRun,
  useMyApiKeys,
  useSetAutopilot,
  useSetSchedule,
} from '@jobsearch/data';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { InfoTip } from '../../../components/InfoTip';
import { TipButton } from '../../../components/TipButton';
import { useErrorText } from '../../../i18n/useErrorText';

/**
 * Kit cost-saving settings. The API adds them in its own change; until then they are missing and
 * their controls stay hidden, and nothing extra is sent.
 */
export interface KitCostRules {
  /** Use the master resume as it is when its free Kit score is at least `kitMasterMin`. */
  kitUseMaster?: boolean;
  kitMasterMin?: number;
  kitWriteResume?: boolean;
  kitWriteCover?: boolean;
  kitWriteAnswers?: boolean;
}
interface KitCostRun {
  kits: number;
  /** In minor units of `currency` (cents, pence). */
  costCents: number;
  savedPercent: number;
  currency: string;
}
type Search = SavedSearch & KitCostRules & { lastKitRun?: KitCostRun | null };
type Rules = AutopilotRules & KitCostRules;

const COST_KEYS = [
  'kitUseMaster',
  'kitMasterMin',
  'kitWriteResume',
  'kitWriteCover',
  'kitWriteAnswers',
] as const;

export const rulesOf = (search: Search): Rules => {
  const rules: Rules = {
    autopilot: search.autopilot,
    autoQueueFitMin: search.autoQueueFitMin,
    autoQueueNeedsVisa: search.autoQueueNeedsVisa,
    autoHideFitBelow: search.autoHideFitBelow,
    autoQueueMaxPerDay: search.autoQueueMaxPerDay,
    autoKits: search.autoKits,
    kitScoreTarget: search.kitScoreTarget,
  };
  for (const key of COST_KEYS) {
    if (search[key] !== undefined) Object.assign(rules, { [key]: search[key] });
  }
  return rules;
};

const same = (a: Rules, b: Rules) =>
  (Object.keys(a) as (keyof Rules)[]).every((key) => a[key] === b[key]);

/** The schedule picker, without "Off": the "Run by itself" switch is the off. */
const RUN_FREQUENCIES = SCHEDULE_FREQUENCIES.filter((f) => f !== 'OFF');

const fieldClass =
  'h-7 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-900 tabular-nums';

/** A small number box: whole numbers from `min` to `max`. Out of range goes back on blur. */
function NumberBox({
  id,
  label,
  short,
  value,
  min,
  max,
  suffix,
  tip,
  onChange,
}: {
  id: string;
  /** The full name, for screen readers. */
  label: string;
  /** What you see, e.g. "Queue ≥". */
  short: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  tip?: ReactNode;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  return (
    <div className="flex min-w-0 items-center gap-1 text-xs whitespace-nowrap text-slate-700">
      <span aria-hidden>{short}</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={text}
        onChange={(event) => {
          // Half-typed numbers stay in the box; only a whole number in range is used.
          setText(event.target.value);
          const next = Number(event.target.value);
          if (event.target.value !== '' && Number.isInteger(next) && next >= min && next <= max) {
            onChange(next);
          }
        }}
        onBlur={() => {
          setText(String(value));
        }}
        className={`${fieldClass} w-12 text-right`}
      />
      {suffix && <span aria-hidden>{suffix}</span>}
      {tip}
    </div>
  );
}

/** A small on/off switch, black and gold. */
function Switch({ on, labelId, onToggle }: { on: boolean; labelId: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelId}
      onClick={onToggle}
      className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${
        on ? 'bg-neutral-900' : 'bg-slate-300'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
          on ? 'left-4 bg-amber-400' : 'left-0.5 bg-white'
        }`}
      />
    </button>
  );
}

/**
 * The opened part of a saved search: when it runs by itself, and Autopilot (queue good fits, hide
 * poor ones, write their apply kits). Short rows, two settings a line; the longer help is in ⓘ
 * tips. Nothing is saved until ✓; ✕ puts everything back.
 */
export function SearchSettings({ search }: { search: Search }) {
  const t = useTranslations('AddJobs.saved');
  const errorText = useErrorText();
  const saveRules = useSetAutopilot();
  const saveSchedule = useSetSchedule();
  const [schedule, setSchedule] = useState<ScheduleFrequency>(search.schedule);
  const [runAt, setRunAt] = useState(search.runAt);
  const [rules, setRules] = useState<Rules>(() => rulesOf(search));
  const scheduleChanged = schedule !== search.schedule || runAt !== search.runAt;
  const rulesChanged = !same(rules, rulesOf(search));
  const id = `search-${search.id}`;
  const set = (patch: Partial<Rules>) => {
    setRules((was) => ({ ...was, ...patch }));
  };
  const saving = saveRules.isPending || saveSchedule.isPending;
  const runs = schedule !== 'OFF';

  return (
    <div className="space-y-2">
      <fieldset className="space-y-1.5 border-t border-slate-200 pt-2">
        <legend className="sr-only">{t('scheduleFor', { name: search.name })}</legend>
        <div className="flex items-center justify-between gap-2">
          <span id={`${id}-run-label`} className="text-xs font-semibold text-slate-900">
            <span aria-hidden>⏰ </span>
            {t('runSelf')}
          </span>
          <Switch
            on={runs}
            labelId={`${id}-run-label`}
            onToggle={() => {
              setSchedule(runs ? 'OFF' : 'DAILY');
            }}
          />
        </div>
        {runs && (
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              id={`${id}-frequency`}
              aria-label={t('runAuto')}
              value={schedule}
              onChange={(event) => {
                setSchedule(event.target.value as ScheduleFrequency);
              }}
              className={fieldClass}
            >
              {RUN_FREQUENCIES.map((value) => (
                <option key={value} value={value}>
                  {t(`frequency.${value}`)}
                </option>
              ))}
            </select>
            <span aria-hidden className="text-xs text-slate-600">
              {t('atShort')}
            </span>
            <input
              id={`${id}-time`}
              type="time"
              required
              aria-label={schedule === 'HOURLY' ? t('atMinute') : t('at')}
              value={runAt}
              onChange={(event) => {
                setRunAt(event.target.value);
              }}
              className={fieldClass}
            />
          </div>
        )}
        {search.scheduleNote && <p className="text-[11px] text-slate-600">{search.scheduleNote}</p>}
      </fieldset>

      <fieldset className="space-y-1.5 border-t border-slate-200 pt-2">
        <legend className="sr-only">{t('autopilotFor', { name: search.name })}</legend>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span id={`${id}-ap-label`} className="text-xs font-semibold text-slate-900">
              {t('autopilot')}
            </span>
            <InfoTip label={t('aboutAutopilot')} text={t('autopilotHint')} />
          </span>
          <Switch
            on={rules.autopilot}
            labelId={`${id}-ap-label`}
            onToggle={() => {
              set({ autopilot: !rules.autopilot });
            }}
          />
        </div>
        {rules.autopilot && (
          <>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
              <NumberBox
                id={`${id}-queue`}
                label={t('queueAt')}
                short={t('queueShort')}
                value={rules.autoQueueFitMin}
                min={1}
                max={100}
                suffix="%"
                onChange={(autoQueueFitMin) => {
                  set({ autoQueueFitMin });
                }}
              />
              <NumberBox
                id={`${id}-hide`}
                label={t('hideBelow')}
                short={t('hideShort')}
                value={rules.autoHideFitBelow}
                min={0}
                max={99}
                suffix="%"
                tip={<InfoTip label={t('aboutHide')} text={t('hideBelowHint')} />}
                onChange={(autoHideFitBelow) => {
                  set({ autoHideFitBelow });
                }}
              />
              <NumberBox
                id={`${id}-max`}
                label={t('maxPerDay')}
                short={t('maxShort')}
                value={rules.autoQueueMaxPerDay}
                min={1}
                max={50}
                onChange={(autoQueueMaxPerDay) => {
                  set({ autoQueueMaxPerDay });
                }}
              />
              <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-slate-700">
                <input
                  id={`${id}-visa`}
                  type="checkbox"
                  aria-label={t('needsVisa')}
                  checked={rules.autoQueueNeedsVisa}
                  onChange={(event) => {
                    set({ autoQueueNeedsVisa: event.target.checked });
                  }}
                  className="accent-neutral-900"
                />
                <span aria-hidden>{t('visaShort')}</span>
              </label>
            </div>
            <KitsBox id={id} rules={rules} set={set} lastKitRun={search.lastKitRun} />
          </>
        )}
      </fieldset>

      {(scheduleChanged || rulesChanged) && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
          <span className="text-[11px] text-slate-600">{t('unsaved')}</span>
          <span className="flex gap-1.5">
            <TipButton
              tip={t('cancelAutopilot')}
              tone="no"
              onClick={() => {
                setSchedule(search.schedule);
                setRunAt(search.runAt);
                setRules(rulesOf(search));
                saveRules.reset();
                saveSchedule.reset();
              }}
            >
              ✕
            </TipButton>
            <TipButton
              tip={t('save')}
              tone="yes"
              disabled={saving || (runs && runAt === '')}
              onClick={() => {
                if (scheduleChanged) saveSchedule.mutate({ id: search.id, schedule, runAt });
                if (rulesChanged) saveRules.mutate({ id: search.id, ...rules });
              }}
            >
              ✓
            </TipButton>
          </span>
        </div>
      )}
      {saveSchedule.isError && (
        <p role="alert" className="text-xs text-red-700">
          {t('scheduleError', { error: errorText(saveSchedule.error) })}
        </p>
      )}
      {saveRules.isError && (
        <p role="alert" className="text-xs text-red-700">
          {t('autopilotError', { error: errorText(saveRules.error) })}
        </p>
      )}
    </div>
  );
}

/**
 * The gold "Write apply kits" box inside Autopilot: the jobs it queues get their kit right after
 * the run, written with your own AI key, aiming at the target score. Its Fit % and daily limit
 * are Autopilot's own.
 */
function KitsBox({
  id,
  rules,
  set,
  lastKitRun,
}: {
  id: string;
  rules: Rules;
  set: (patch: Partial<Rules>) => void;
  lastKitRun: KitCostRun | null | undefined;
}) {
  const t = useTranslations('AddJobs.saved');
  const format = useFormatter();
  const keys = useMyApiKeys();
  const run = useKitRun();
  const hasKey = (keys.data ?? []).some((k) => k.kind === 'ANTHROPIC' || k.kind === 'OPENAI');
  // Until the keys are loaded, don't grey it out.
  const noKey = keys.isSuccess && !hasKey;
  const writing = run.data?.running ? run.data : null;
  const on = rules.autoKits && !noKey;
  const parts = (
    [
      ['kitWriteResume', 'writeResume'],
      ['kitWriteCover', 'writeCover'],
      ['kitWriteAnswers', 'writeAnswers'],
    ] as const
  ).filter(([key]) => rules[key] !== undefined);

  return (
    <div className="space-y-1.5 rounded-md bg-amber-50 p-2 text-amber-950">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold">
          <input
            id={`${id}-kits`}
            type="checkbox"
            aria-label={t('kitsOn')}
            checked={on}
            disabled={noKey}
            onChange={(event) => {
              set({ autoKits: event.target.checked });
            }}
            className="accent-neutral-900"
          />
          <span aria-hidden className={noKey ? 'text-slate-500' : undefined}>
            {t('kitsShort')}
          </span>
        </label>
        <InfoTip
          label={t('aboutKits')}
          text={`${t('kitsHint', { max: rules.autoQueueMaxPerDay })} ${t('kitsTargetHint')}`}
        />
      </div>
      {noKey && (
        <p role="alert" className="text-xs text-red-700">
          {t('kitsNoKey')}{' '}
          <Link href="/settings?tab=keys" className="font-medium underline">
            {t('kitsAddKey')}
          </Link>
        </p>
      )}
      {on && (
        <>
          <Slider
            id={`${id}-target`}
            label={t('kitsTarget')}
            short={t('targetShort')}
            min={70}
            max={95}
            value={rules.kitScoreTarget}
            onChange={(kitScoreTarget) => {
              set({ kitScoreTarget });
            }}
          />
          {rules.kitUseMaster !== undefined && (
            <>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={rules.kitUseMaster}
                  onChange={(event) => {
                    set({ kitUseMaster: event.target.checked });
                  }}
                  className="accent-neutral-900"
                />
                {t('useMaster')}
                <InfoTip label={t('aboutMaster')} text={t('useMasterHint')} />
              </label>
              {rules.kitUseMaster && (
                <div className="pl-5">
                  <Slider
                    id={`${id}-master`}
                    label={t('masterMin')}
                    min={80}
                    max={100}
                    value={rules.kitMasterMin ?? rules.kitScoreTarget}
                    onChange={(kitMasterMin) => {
                      set({ kitMasterMin });
                    }}
                  />
                </div>
              )}
            </>
          )}
          {parts.length > 0 && (
            <div
              role="group"
              aria-label={t('writes')}
              className="flex flex-wrap items-center gap-1 text-xs"
            >
              <span aria-hidden>{t('writes')}</span>
              {parts.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={rules[key] === true}
                  onClick={() => {
                    set({ [key]: !rules[key] });
                  }}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    rules[key]
                      ? 'border-neutral-900 bg-neutral-900 text-amber-300'
                      : 'border-amber-800/50 text-amber-900'
                  }`}
                >
                  {rules[key] && <span aria-hidden>✓ </span>}
                  {t(label)}
                </button>
              ))}
              <InfoTip label={t('aboutWrites')} text={t('writesHint')} />
            </div>
          )}
          {lastKitRun && (
            <p className="flex justify-between gap-2 border-t border-dashed border-amber-800/30 pt-1 text-[11px]">
              <span>
                {t('lastKits', {
                  kits: lastKitRun.kits,
                  cost: format.number(lastKitRun.costCents / 100, {
                    style: 'currency',
                    currency: lastKitRun.currency,
                  }),
                })}
              </span>
              {lastKitRun.savedPercent > 0 && (
                <b>{t('savedPercent', { percent: lastKitRun.savedPercent })}</b>
              )}
            </p>
          )}
        </>
      )}
      {writing && (
        <p role="status" className="text-xs text-emerald-800">
          {t('kitsWriting', {
            done: Math.min(writing.done + 1, writing.total),
            total: writing.total,
          })}
        </p>
      )}
    </div>
  );
}

function Slider({
  id,
  label,
  short,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  short?: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {short && <span aria-hidden>{short}</span>}
      <input
        id={id}
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={5}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        className="min-w-0 flex-1 accent-amber-500"
      />
      <b aria-hidden className="w-9 text-right tabular-nums">
        {value}%
      </b>
    </div>
  );
}
