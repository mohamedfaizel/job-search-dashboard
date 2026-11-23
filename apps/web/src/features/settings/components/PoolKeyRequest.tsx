import type { ApiKey, MyPoolKey } from '@jobsearch/data';
import {
  useCancelPoolKeyRequest,
  useGivePoolKeyBack,
  useMyPoolKey,
  useRequestPoolKey,
} from '@jobsearch/data';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { timeAgo } from '../../../components/NotificationBell';
import { TipButton } from '../../../components/TipButton';
import { useErrorText } from '../../../i18n/useErrorText';

const box = 'space-y-2 rounded-md border p-3 text-sm';

/**
 * The JobHunter part of Settings › API keys: your own token, or one lent by the admins from the
 * Key pool. `ownCard` is the usual key card for your own token. A lent key is never shown, not
 * even a part of it.
 */
export function JobHunterKey({ own, ownCard }: { own: ApiKey | null; ownCard: ReactNode }) {
  const t = useTranslations('Settings.keys');
  const errorText = useErrorText();
  const mine = useMyPoolKey();

  const state = mine.data;

  if (state?.state === 'APPROVED' && !own) {
    return (
      <>
        <Lent state={state} />
        <details className="rounded-md border border-slate-200 px-4 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-slate-800">
            {t('pool.ownOptional')}
          </summary>
          <div className="pt-3">{ownCard}</div>
        </details>
      </>
    );
  }
  return (
    <div className="space-y-3">
      {ownCard}
      {/* With your own token there is nothing to ask for. */}
      {state && !own && (
        <>
          <p className="flex items-center gap-3 text-xs text-slate-500 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
            {state.state === 'DENIED' ? t('pool.useOwn') : t('pool.or')}
          </p>
          <Ask state={state} />
        </>
      )}
      {mine.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(mine.error)}
        </p>
      )}
    </div>
  );
}

function Ask({ state }: { state: MyPoolKey }) {
  const t = useTranslations('Settings.keys.pool');
  const format = useFormatter();
  const locale = useLocale();
  const errorText = useErrorText();
  const request = useRequestPoolKey();
  const cancel = useCancelPoolKeyRequest();

  if (state.state === 'PENDING') {
    return (
      <div className={`${box} border-amber-200 bg-amber-50`}>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
          {t('sent')}
        </span>
        <p>
          <b>{t('waitingTitle')}</b>{' '}
          {t('waitingText', {
            when: state.requestedAt ? timeAgo(state.requestedAt, locale) : '',
          })}
        </p>
        <div className="flex items-center gap-2">
          <TipButton
            tip={t('cancel')}
            tone="no"
            disabled={cancel.isPending}
            onClick={() => {
              cancel.mutate();
            }}
          >
            ✕
          </TipButton>
          <span className="text-xs text-slate-600">{t('ownCancels')}</span>
        </div>
      </div>
    );
  }
  if (state.state === 'DENIED') {
    return (
      <div className={`${box} border-red-200 bg-red-50`}>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
          {t('denied')}
        </span>
        <p>
          <b>{t('deniedTitle')}</b> {state.note && t('deniedNote', { note: state.note })}
        </p>
        {state.askAgainAt && (
          <p className="text-xs text-slate-600">
            {t('askAgain', {
              date: format.dateTime(new Date(state.askAgainAt), { dateStyle: 'medium' }),
            })}{' '}
            {t('freeSources')}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className={`${box} border-dashed border-slate-300 bg-slate-50`}>
      <p>
        <b>{state.poolEmpty ? t('emptyTitle') : t('askTitle')}</b>{' '}
        {state.poolEmpty ? t('emptyText') : t('ask')}
      </p>
      <button
        type="button"
        disabled={request.isPending}
        onClick={() => {
          request.mutate();
        }}
        className={
          state.poolEmpty
            ? 'rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60'
            : 'rounded-md bg-brand-400 px-3 py-1.5 font-semibold text-slate-900 hover:bg-brand-300 disabled:opacity-60'
        }
      >
        {request.isPending ? t('requesting') : state.poolEmpty ? t('joinList') : t('request')}
      </button>
      {request.isError && (
        <p role="alert" className="text-red-700">
          {errorText(request.error)}
        </p>
      )}
    </div>
  );
}

function Lent({ state }: { state: MyPoolKey }) {
  const t = useTranslations('Settings.keys');
  const giveBack = useGivePoolKeyBack();
  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-900">{t('jobhunter.name')}</h3>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {t('pool.fromAdmin')}
        </span>
      </div>
      <div className={`${box} border-emerald-200 bg-emerald-50/60`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-slate-500">
            <span aria-hidden="true">•••••••••••• </span>
            <span className="font-sans text-xs">{t('pool.hidden')}</span>
          </span>
          <span className="text-xs text-slate-600">
            {t('pool.usage', { limit: state.limit, used: state.used })}
          </span>
        </div>
        <p>{t('pool.approvedText')}</p>
      </div>
      <div className="flex items-center gap-2">
        <TipButton
          tip={t('pool.giveBack')}
          tone="no"
          disabled={giveBack.isPending}
          onClick={() => {
            giveBack.mutate();
          }}
        >
          ✕
        </TipButton>
        <span className="text-xs text-slate-600">{t('pool.giveBackHint')}</span>
      </div>
    </div>
  );
}
