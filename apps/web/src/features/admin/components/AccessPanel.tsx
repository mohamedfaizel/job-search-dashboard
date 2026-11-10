'use client';

import type { Invite, SignupMode } from '@jobsearch/data';
import {
  useAppSettings,
  useCancelInvite,
  useCreateInvite,
  useInvites,
  useUpdateAppSettings,
} from '@jobsearch/data';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '@/i18n/useErrorText';

const MODES: SignupMode[] = ['OPEN', 'INVITE', 'CLOSED'];
const EXPIRY = { '7': 7, '30': 30, never: null } as const;
const USES = { '1': 1, '10': 10, any: null } as const;

const SELECT = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';

/** The address people open: this site's own, so it works on any server. */
const linkOf = (token: string) => `${window.location.origin}/signup?invite=${token}`;

/**
 * Admin › Sign-up & access: who can make an account (open, invite only, closed) and the invite
 * links. Each change saves on its own and works at once.
 */
export function AccessPanel() {
  const t = useTranslations('Admin.access');
  const errorText = useErrorText();
  const settings = useAppSettings();
  const update = useUpdateAppSettings();

  if (settings.isPending) return <p className="text-sm text-slate-600">{t('loading')}</p>;
  if (settings.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(settings.error)}
      </p>
    );
  }
  const mode = settings.data.signupMode;

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <fieldset className="space-y-3">
          <legend className="text-base font-semibold text-slate-900">{t('modeHeading')}</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {MODES.map((id) => (
              <label
                key={id}
                htmlFor={`signup-mode-${id}`}
                className={`grid grid-cols-[auto_1fr] gap-x-2.5 rounded-lg border p-3 text-sm ${
                  mode === id ? 'border-brand-400 bg-brand-50' : 'border-slate-200'
                }`}
              >
                <input
                  id={`signup-mode-${id}`}
                  type="radio"
                  name="signup-mode"
                  checked={mode === id}
                  disabled={update.isPending}
                  onChange={() => {
                    update.mutate({ signupMode: id });
                  }}
                  className="row-span-2 mt-0.5"
                />
                <b className="font-semibold text-slate-900">{t(`mode.${id}`)}</b>
                <span className="text-xs text-slate-600">{t(`modeHint.${id}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p aria-live="polite" className="text-xs text-slate-600">
          {update.isError ? (
            <span className="text-red-700">{errorText(update.error)}</span>
          ) : update.isSuccess ? (
            t('saved')
          ) : (
            t('saves')
          )}
        </p>
      </section>
      <InviteLinks />
    </div>
  );
}

function InviteLinks() {
  const t = useTranslations('Admin.access');
  const errorText = useErrorText();
  const invites = useInvites();
  const create = useCreateInvite();
  const cancel = useCancelInvite();
  const [expiry, setExpiry] = useState<keyof typeof EXPIRY>('7');
  const [uses, setUses] = useState<keyof typeof USES>('1');
  const error = create.error ?? cancel.error ?? invites.error;

  return (
    <section
      aria-labelledby="invites-heading"
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 sm:px-5">
        <h2 id="invites-heading" className="flex-1 text-base font-semibold text-slate-900">
          {t('invitesHeading')}
        </h2>
        <label className="flex items-center gap-1.5 text-sm">
          {t('expiresAfter')}
          <select
            value={expiry}
            onChange={(event) => {
              setExpiry(event.target.value as keyof typeof EXPIRY);
            }}
            className={SELECT}
          >
            {Object.keys(EXPIRY).map((key) => (
              <option key={key} value={key}>
                {t(`expiry.${key as keyof typeof EXPIRY}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          {t('canBeUsed')}
          <select
            value={uses}
            onChange={(event) => {
              setUses(event.target.value as keyof typeof USES);
            }}
            className={SELECT}
          >
            {Object.keys(USES).map((key) => (
              <option key={key} value={key}>
                {t(`useCount.${key as keyof typeof USES}`)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={create.isPending}
          onClick={() => {
            create.mutate({ expiresInDays: EXPIRY[expiry], maxUses: USES[uses] });
          }}
          className="rounded-md bg-brand-400 px-3.5 py-2 text-sm font-semibold text-black hover:bg-brand-300 disabled:opacity-60"
        >
          {create.isPending ? t('making') : t('newInvite')}
        </button>
      </div>
      {error && (
        <p role="alert" className="px-4 pt-3 text-sm text-red-700 sm:px-5">
          {errorText(error)}
        </p>
      )}
      {invites.isPending ? (
        <p className="p-4 text-sm text-slate-600 sm:px-5">{t('loading')}</p>
      ) : invites.data?.length ? (
        <ul>
          {invites.data.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              canceling={cancel.isPending}
              onCancel={() => {
                cancel.mutate(invite.id);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="p-4 text-sm text-slate-600 sm:px-5">{t('none')}</p>
      )}
      <p className="border-t border-slate-100 p-4 text-xs text-slate-600 sm:px-5">{t('note')}</p>
    </section>
  );
}

function InviteRow({
  invite,
  canceling,
  onCancel,
}: {
  invite: Invite;
  canceling: boolean;
  onCancel: () => void;
}) {
  const t = useTranslations('Admin.access');
  const format = useFormatter();
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const code = `${invite.token.slice(0, 4)}…`;
  const dead = invite.state !== 'ACTIVE';
  const expires =
    invite.state === 'EXPIRED'
      ? t('expired')
      : invite.expiresAt
        ? format.relativeTime(new Date(invite.expiresAt), new Date())
        : t('never');

  return (
    <li className="grid gap-2 border-t border-slate-100 px-4 py-3 text-sm first:border-t-0 sm:px-5 md:grid-cols-[2.4fr_1fr_1fr_1fr_auto] md:items-center">
      <code className={`truncate text-xs ${dead ? 'text-slate-500' : 'text-slate-700'}`}>
        /signup?invite={code}
      </code>
      <span className="text-slate-700">
        <span className="text-xs text-slate-500 md:sr-only">{t('made')}: </span>
        {format.dateTime(new Date(invite.createdAt), { day: 'numeric', month: 'short' })}
      </span>
      <span className={invite.state === 'EXPIRED' ? 'text-red-700' : 'text-slate-700'}>
        <span className="text-xs text-slate-500 md:sr-only">{t('expires')}: </span>
        {expires}
      </span>
      <span className="text-slate-700">
        <span className="text-xs text-slate-500 md:sr-only">{t('used')}: </span>
        {invite.maxUses === null
          ? t('usedAny', { uses: invite.uses })
          : t('usedOf', { uses: invite.uses, max: invite.maxUses })}
      </span>
      <span className="flex flex-wrap gap-1.5 md:justify-end">
        {!dead && (
          <button
            type="button"
            aria-label={t('copyFor', { code })}
            onClick={() => {
              navigator.clipboard.writeText(linkOf(invite.token)).then(
                () => {
                  setCopy('copied');
                },
                () => {
                  setCopy('failed');
                },
              );
            }}
            className="min-h-9 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
          >
            {copy === 'copied' ? t('copied') : t('copy')}
          </button>
        )}
        <button
          type="button"
          aria-label={t('cancelFor', { code })}
          disabled={canceling}
          onClick={onCancel}
          className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {t('cancel')}
        </button>
      </span>
      {copy === 'failed' && (
        <p role="alert" className="text-xs text-red-700 md:col-span-5">
          {t('copyFailed')} <code className="break-all">{linkOf(invite.token)}</code>
        </p>
      )}
    </li>
  );
}
