import type { ApiKey, ApiKeyKind } from '@jobsearch/data';
import { useDeleteApiKey, useMyApiKeys, useSaveApiKey, useTestApiKey } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

const card = 'space-y-4 rounded-lg border border-slate-200 bg-white p-5';
const button =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60';

/** Settings > API keys: your own keys, so you spend your own credits. */
export function ApiKeys() {
  const errorText = useErrorText();
  const t = useTranslations('Settings.keys');
  const keys = useMyApiKeys();

  return (
    <section aria-labelledby="keys-heading" className={card}>
      <div>
        <h2 id="keys-heading" className="text-lg font-semibold text-slate-900">
          {t('heading')}
        </h2>
        <p className="text-sm text-slate-600">{t('intro')}</p>
      </div>
      {keys.isPending ? (
        <p className="text-sm text-slate-500">{t('loading')}</p>
      ) : keys.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {t('loadFailed', { error: errorText(keys.error) })}
        </p>
      ) : (
        <KeyCard
          kind="JOBHUNTER"
          name={t('jobhunter.name')}
          hint={t('jobhunter.hint')}
          testHint={t('jobhunter.testHint')}
          saved={keys.data.find((key) => key.kind === 'JOBHUNTER') ?? null}
        />
      )}
    </section>
  );
}

interface CardProps {
  kind: ApiKeyKind;
  name: string;
  hint: string;
  testHint: string;
  saved: ApiKey | null;
}

/** One key: masked when saved (Test, Replace, delete), a password box when not. */
function KeyCard({ kind, name, hint, testHint, saved }: CardProps) {
  const errorText = useErrorText();
  const t = useTranslations('Settings.keys');
  const inputId = useId();
  const save = useSaveApiKey();
  const remove = useDeleteApiKey();
  const test = useTestApiKey();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [confirming, setConfirming] = useState(false);
  const showForm = !saved || editing;

  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-900">{name}</h3>
        {saved ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {saved.credits === null
              ? `✓ ${t('saved')}`
              : `✓ ${t('saved')} · ${t('credits', { count: saved.credits })}`}
          </span>
        ) : (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            {t('notSet')}
          </span>
        )}
      </div>

      {saved && !editing && (
        <div className="flex flex-wrap items-center gap-2">
          <code
            className="w-full min-w-0 truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-sm text-slate-700 sm:w-auto sm:flex-1"
            aria-label={t('masked', { last4: saved.last4 })}
          >
            {`••••••••••••${saved.last4}`}
          </code>
          <button
            type="button"
            className={button}
            disabled={test.isPending}
            onClick={() => {
              test.mutate(kind);
            }}
          >
            {test.isPending ? t('testing') : t('test')}
          </button>
          <button
            type="button"
            className={button}
            onClick={() => {
              setEditing(true);
              test.reset();
            }}
          >
            {t('replace')}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white p-1.5 text-red-600 hover:bg-red-50"
            aria-label={t('deleteLabel', { name })}
            title={t('delete')}
            onClick={() => {
              setConfirming(true);
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      )}

      {confirming && saved && (
        <div
          role="alertdialog"
          aria-label={t('delete')}
          className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span className="flex-1">{t('confirmDelete')}</span>
          <button
            type="button"
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(kind, {
                onSuccess: () => {
                  setConfirming(false);
                },
              });
            }}
          >
            {t('delete')}
          </button>
          <button
            type="button"
            className={button}
            onClick={() => {
              setConfirming(false);
            }}
          >
            {t('cancel')}
          </button>
        </div>
      )}

      {showForm && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(
              { kind, value },
              {
                onSuccess: () => {
                  setValue('');
                  setEditing(false);
                },
              },
            );
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            {name}
          </label>
          <input
            id={inputId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('paste')}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={save.isPending || value.trim() === ''}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {save.isPending ? t('saving') : t('save')}
          </button>
          {editing && (
            <button
              type="button"
              className={button}
              onClick={() => {
                setEditing(false);
                setValue('');
                save.reset();
              }}
            >
              {t('cancel')}
            </button>
          )}
        </form>
      )}

      {save.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t('saveFailed', { error: errorText(save.error) })}
        </p>
      )}
      {test.data && (
        <p
          role={test.data.ok ? 'status' : 'alert'}
          className={`text-sm ${test.data.ok ? 'text-emerald-700' : 'text-red-700'}`}
        >
          {test.data.ok
            ? test.data.credits === null
              ? `✓ ${t('works')}`
              : `✓ ${t('works')} · ${t('credits', { count: test.data.credits })}`
            : t('testFailed', { error: test.data.error ?? '' })}
        </p>
      )}
      {test.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t('testFailed', { error: errorText(test.error) })}
        </p>
      )}
      <p className="text-xs text-slate-500">
        {hint} {saved && testHint}
      </p>
    </div>
  );
}
