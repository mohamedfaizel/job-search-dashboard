'use client';

import type { KeyPool, PoolKey } from '@jobsearch/data';
import {
  useAddPoolKeys,
  useApproveKeyRequest,
  useDenyKeyRequest,
  useKeyPool,
  useRemovePoolKey,
  useTakeBackPoolKey,
  useUpdateAppSettings,
} from '@jobsearch/data';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { InfoTip } from '@/components/InfoTip';
import { timeAgo } from '@/components/NotificationBell';
import { SwapIcon, TipButton } from '@/components/TipButton';
import { useErrorText } from '@/i18n/useErrorText';

const CARD = 'rounded-lg border border-slate-200 bg-white p-4 sm:p-5';
type Filter = 'ALL' | PoolKey['status'];

/**
 * Admin › Key pool: JobHunter tokens the admins may hand out. Admins add keys, answer requests
 * and take keys back. A key is never shown, not even a part of it: each has a number only.
 */
export function KeyPoolPanel() {
  const t = useTranslations('Admin.keys');
  const errorText = useErrorText();
  const pool = useKeyPool();

  if (pool.isPending) return <p className="text-sm text-slate-600">{t('loading')}</p>;
  if (pool.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(pool.error)}
      </p>
    );
  }
  const p = pool.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Count value={p.free} label={t('free')} tone="border-t-emerald-600" />
        <Count value={p.assigned} label={t('assigned')} tone="border-t-indigo-700" />
        <Count value={p.empty} label={t('empty')} tone="border-t-slate-400" />
        <Count value={p.requests.length} label={t('waiting')} tone="border-t-brand-400" />
      </div>
      <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-800">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-brand-400"
        >
          !
        </span>
        {t('warn')}
      </p>
      <Requests pool={p} />
      <Keys pool={p} />
    </div>
  );
}

function Count({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className={`rounded-lg border border-t-4 border-slate-200 bg-white px-4 py-3 ${tone}`}>
      <b className="block text-2xl leading-tight font-bold text-slate-900">{value}</b>
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

/** Hours an admin can pick for the wait; 0 gives the key at once. */
const WAIT_CHOICES = [0, 24, 48];

function Requests({ pool }: { pool: KeyPool }) {
  const t = useTranslations('Admin.keys');
  const locale = useLocale();
  const errorText = useErrorText();
  const settings = useUpdateAppSettings();
  const approve = useApproveKeyRequest();
  const deny = useDenyKeyRequest();
  const [denying, setDenying] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const limitId = useId();
  const autoId = useId();
  const waitId = useId();
  const [limit, setLimit] = useState(String(pool.limit));
  const error = approve.error ?? deny.error ?? settings.error;

  const saveLimit = () => {
    const next = Number(limit);
    if (!Number.isInteger(next) || next < 0 || next > 1_000_000) {
      setLimit(String(pool.limit));
      return;
    }
    if (next !== pool.limit) settings.mutate({ poolKeyLimit: next });
  };

  return (
    <section aria-labelledby="pool-requests" className={CARD}>
      <h2 id="pool-requests" className="flex items-center gap-2 font-semibold text-slate-900">
        {t('requests')}
        {pool.requests.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
            {t('waitingChip', { count: pool.requests.length })}
          </span>
        )}
      </h2>
      <p className="mb-3 text-sm text-slate-600">{t('requestsHint')}</p>

      <div className="mb-3 flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={pool.autoApprove}
          aria-labelledby={autoId}
          disabled={settings.isPending}
          onClick={() => {
            settings.mutate({ poolAutoApprove: !pool.autoApprove });
          }}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            pool.autoApprove ? 'bg-slate-900' : 'bg-slate-300'
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 h-4 w-4 rounded-full transition-all ${
              pool.autoApprove ? 'right-1 bg-brand-400' : 'left-1 bg-white'
            }`}
          />
        </button>
        <div>
          <span id={autoId} className="block text-sm font-semibold text-slate-900">
            {t('autoApprove')}
          </span>
          <span className="text-xs text-slate-600">{t('autoApproveHint')}</span>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <label htmlFor={waitId} className="text-sm font-semibold text-slate-900">
          {t('wait')}
        </label>
        <select
          id={waitId}
          value={pool.waitHours}
          disabled={settings.isPending}
          onChange={(event) => {
            settings.mutate({ poolWaitHours: Number(event.target.value) });
          }}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          {WAIT_CHOICES.includes(pool.waitHours) ? null : (
            <option value={pool.waitHours}>{t('waitHours', { hours: pool.waitHours })}</option>
          )}
          {WAIT_CHOICES.map((hours) => (
            <option key={hours} value={hours}>
              {hours === 0 ? t('waitNow') : t('waitHours', { hours })}
            </option>
          ))}
        </select>
        <span className="w-full text-xs text-slate-600">{t('waitHint')}</span>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <label htmlFor={limitId} className="text-sm font-semibold text-slate-900">
          {t('limit')}
        </label>
        <input
          id={limitId}
          type="number"
          inputMode="numeric"
          min={0}
          value={limit}
          onChange={(event) => {
            setLimit(event.target.value);
          }}
          onBlur={saveLimit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') saveLimit();
          }}
          className="h-8 w-24 rounded-md border border-slate-300 px-2 text-right text-sm"
        />
        <span className="text-xs text-slate-600">{t('limitHint')}</span>
      </div>

      {pool.requests.length === 0 ? (
        <p className="text-sm text-slate-600">{t('noRequests')}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {pool.requests.map((request) => (
            <li key={request.id} className="space-y-2 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-sm font-semibold text-slate-900">
                    {request.name}
                  </b>
                  <span className="block truncate text-xs text-slate-600">{request.email}</span>
                </div>
                <span className="hidden text-sm text-slate-600 sm:block">
                  {timeAgo(request.createdAt, locale)}
                </span>
                <TipButton
                  tip={t('approve')}
                  tone="yes"
                  disabled={approve.isPending}
                  onClick={() => {
                    approve.mutate(request.id);
                  }}
                >
                  ✓
                </TipButton>
                <TipButton
                  tip={t('deny')}
                  tone="no"
                  onClick={() => {
                    setDenying(denying === request.id ? null : request.id);
                    setNote('');
                  }}
                >
                  ✕
                </TipButton>
              </div>
              {denying === request.id && (
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    deny.mutate(
                      { id: request.id, note: note.trim() || undefined },
                      {
                        onSuccess: () => {
                          setDenying(null);
                        },
                      },
                    );
                  }}
                >
                  <input
                    aria-label={t('denyNote')}
                    placeholder={t('denyNote')}
                    maxLength={300}
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                    }}
                    className="h-8 min-w-48 flex-1 rounded-md border border-slate-300 px-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={deny.isPending}
                    className="h-8 rounded-md bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {t('denySend')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDenying(null);
                    }}
                    className="h-8 rounded-md border border-slate-300 px-3 text-sm text-slate-700"
                  >
                    {t('cancel')}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {errorText(error)}
        </p>
      )}
    </section>
  );
}

function AddKeys() {
  const t = useTranslations('Admin.keys');
  const errorText = useErrorText();
  const add = useAddPoolKeys();
  const [keys, setKeys] = useState('');
  const [note, setNote] = useState('');

  return (
    <form
      className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!keys.trim()) return;
        add.mutate(
          { keys, note },
          {
            onSuccess: () => {
              setKeys('');
            },
          },
        );
      }}
    >
      <span className="px-1 text-sm font-bold whitespace-nowrap text-slate-900">
        {t('addLabel')}
      </span>
      {/* A password box: pasted keys show as dots, never as text on screen. */}
      <input
        type="password"
        autoComplete="off"
        aria-label={t('addPlaceholder')}
        placeholder={t('addPlaceholder')}
        value={keys}
        onChange={(event) => {
          setKeys(event.target.value);
        }}
        className="h-8 min-w-40 flex-[2_1_14rem] rounded-md border border-slate-300 bg-white px-2 text-sm tracking-wider"
      />
      <input
        aria-label={t('note')}
        placeholder={t('notePlaceholder')}
        maxLength={100}
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
        }}
        className="h-8 min-w-32 flex-[1_1_9rem] rounded-md border border-slate-300 bg-white px-2 text-sm"
      />
      <button
        type="submit"
        aria-label={t('add')}
        title={t('add')}
        disabled={add.isPending || !keys.trim()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white font-bold text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
      >
        ✓
      </button>
      <InfoTip label={t('addHow')} text={t('addInfo')} />
      <span aria-live="polite" className="text-xs font-semibold whitespace-nowrap">
        {add.isError ? (
          <span className="text-red-700">{errorText(add.error)}</span>
        ) : (
          add.data && <span className="text-emerald-700">{t('added', { ...add.data })}</span>
        )}
      </span>
    </form>
  );
}

const STATUS_CHIP: Record<PoolKey['status'], string> = {
  FREE: 'bg-emerald-50 text-emerald-700',
  ASSIGNED: 'bg-indigo-50 text-indigo-800',
  EMPTY: 'bg-slate-100 text-slate-600',
};

function Keys({ pool }: { pool: KeyPool }) {
  const t = useTranslations('Admin.keys');
  const errorText = useErrorText();
  const takeBack = useTakeBackPoolKey();
  const remove = useRemovePoolKey();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [confirming, setConfirming] = useState<number | null>(null);
  const shown = filter === 'ALL' ? pool.keys : pool.keys.filter((key) => key.status === filter);
  const filters: [Filter, string][] = [
    ['ALL', t('filterAll', { count: pool.keys.length })],
    ['FREE', t('filterFree', { count: pool.free })],
    ['ASSIGNED', t('filterAssigned', { count: pool.assigned })],
    ['EMPTY', t('filterEmpty', { count: pool.empty })],
  ];
  const error = takeBack.error ?? remove.error;

  return (
    <section aria-labelledby="pool-keys" className={CARD}>
      <h2 id="pool-keys" className="font-semibold text-slate-900">
        {t('keys', { count: pool.keys.length })}
      </h2>
      <p className="mb-3 text-sm text-slate-600">{t('keysHint')}</p>
      <AddKeys />
      <div className="mb-2 flex flex-wrap gap-1.5">
        {filters.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => {
              setFilter(id);
            }}
            className="rounded-full border border-slate-300 bg-white px-3 py-0.5 text-xs text-slate-700 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white"
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length > 0 && (
        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="hidden bg-slate-50 text-left text-xs text-slate-600 md:table-header-group">
              <tr>
                <th className="px-3 py-2 font-medium">{t('key')}</th>
                <th className="px-3 py-2 font-medium">{t('status')}</th>
                <th className="px-3 py-2 font-medium">{t('givenTo')}</th>
                <th className="px-3 py-2 font-medium">{t('usedLimit')}</th>
                <th className="px-3 py-2 font-medium">{t('note')}</th>
                <th className="px-3 py-2">
                  <span className="sr-only">{t('status')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((key) => (
                <tr
                  key={key.id}
                  className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-3 py-2.5 md:table-row md:p-0"
                >
                  <td className="font-mono text-[13px] md:px-3 md:py-2.5">
                    {t('keyNumber', { id: key.id })}{' '}
                    <span aria-hidden="true" className="text-slate-400">
                      ••••••••
                    </span>
                  </td>
                  <td className="col-start-1 md:px-3 md:py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CHIP[key.status]}`}
                    >
                      {t(`status${key.status}`)}
                    </span>
                  </td>
                  <td className="col-start-1 text-slate-700 md:px-3 md:py-2.5">
                    <span className="text-xs text-slate-500 md:hidden">{t('givenTo')}: </span>
                    {key.holder ?? '–'}
                  </td>
                  <td className="col-start-1 md:px-3 md:py-2.5">
                    <span className="text-xs text-slate-500 md:hidden">{t('usedLimit')}: </span>
                    {key.status === 'FREE' ? (
                      <span className="text-slate-500">
                        – {key.credits !== null && t('onKey', { credits: key.credits })}
                      </span>
                    ) : (
                      <>
                        {key.used} / {pool.limit}{' '}
                        {key.status === 'ASSIGNED' && key.used >= pool.limit && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                            {t('limitReached')}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="col-start-1 text-slate-700 md:px-3 md:py-2.5">
                    <span className="text-xs text-slate-500 md:hidden">{t('note')}: </span>
                    {key.note || '–'}
                  </td>
                  <td className="col-start-2 row-span-5 row-start-1 self-center md:px-3 md:py-2.5 md:text-right">
                    <div className="flex justify-end gap-1.5">
                      {key.status === 'ASSIGNED' && (
                        <TipButton
                          tip={t('passOn')}
                          tone="plain"
                          disabled={takeBack.isPending || pool.requests.length === 0}
                          onClick={() => {
                            takeBack.mutate({ id: key.id, passOn: true });
                          }}
                        >
                          <SwapIcon />
                        </TipButton>
                      )}
                      <TipButton
                        tip={key.status === 'ASSIGNED' ? t('takeBack') : t('remove')}
                        tone="no"
                        disabled={takeBack.isPending || remove.isPending}
                        onClick={() => {
                          if (key.status === 'ASSIGNED') {
                            takeBack.mutate({ id: key.id, passOn: false });
                          } else {
                            setConfirming(key.id);
                          }
                        }}
                      >
                        ✕
                      </TipButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirming !== null && (
        <div
          role="alertdialog"
          aria-label={t('remove')}
          className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span className="flex-1">{t('confirmRemove', { id: confirming })}</span>
          <button
            type="button"
            className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(confirming, {
                onSuccess: () => {
                  setConfirming(null);
                },
              });
            }}
          >
            {t('remove')}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700"
            onClick={() => {
              setConfirming(null);
            }}
          >
            {t('cancel')}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {errorText(error)}
        </p>
      )}
      <p className="mt-3 text-xs text-slate-600">{t('footer')}</p>
    </section>
  );
}
