import type { AiProvider, ApiKey, ApiKeyKind } from '@jobsearch/data';
import {
  useDeleteApiKey,
  useMe,
  useMyApiKeys,
  useSaveApiKey,
  useSetAiProvider,
  useSetApiKeyModel,
  useTestApiKey,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { AI_CHATS } from '../../../lib/ai-chat';
import { noteAiResult } from '../../../lib/ai-status';
import { ResumeMatcherStatus } from './ResumeMatcherStatus';

const card = 'space-y-4 rounded-lg border border-slate-200 bg-white p-5';
const button =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60';

/** The model used when the box is empty (the server has the same defaults), and a few others. */
const MODELS: Record<AiProvider, { default: string; more: string[] }> = {
  ANTHROPIC: { default: 'claude-sonnet-5-5', more: ['claude-haiku-5-5', 'claude-opus-5-5'] },
  OPENAI: { default: 'gpt-5-mini', more: ['gpt-5', 'gpt-5-nano'] },
};
const PROVIDERS: AiProvider[] = ['ANTHROPIC', 'OPENAI'];

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
        <>
          <KeyCard
            kind="JOBHUNTER"
            name={t('jobhunter.name')}
            hint={t('jobhunter.hint')}
            testHint={t('jobhunter.testHint')}
            paste={t('paste')}
            confirmDelete={t('confirmDelete')}
            saved={keys.data.find((key) => key.kind === 'JOBHUNTER') ?? null}
          />
          <AiKeys keys={keys.data} />
        </>
      )}
    </section>
  );
}

/**
 * Your AI: Claude or OpenAI, with its key and model. The AI score runs on it, and the
 * copy-and-open buttons everywhere open its chat. Resume-Matcher's status sits below, since it
 * is what uses the key.
 */
function AiKeys({ keys }: { keys: ApiKey[] }) {
  const t = useTranslations('Settings.keys.ai');
  const { data: me } = useMe();
  const pick = useSetAiProvider();
  const provider = me?.aiProvider ?? 'ANTHROPIC';

  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-4">
      <div>
        <h3 className="font-semibold text-slate-900">{t('heading')}</h3>
        <p className="text-sm text-slate-600">{t('intro')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span id="ai-pick" className="text-sm font-medium text-slate-800">
          {t('pick')}
        </span>
        <div role="radiogroup" aria-labelledby="ai-pick" className="flex gap-1">
          {PROVIDERS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={provider === option}
              disabled={pick.isPending}
              onClick={() => {
                if (option !== provider) pick.mutate(option);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 aria-checked:border-slate-900 aria-checked:bg-slate-900 aria-checked:text-white"
            >
              {t(option)}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          {t('chatOpens', { chat: AI_CHATS[provider].name })}
        </span>
      </div>
      {/* key= starts a fresh card for the other provider, with its own form state. */}
      <KeyCard
        key={provider}
        kind={provider}
        name={t(`keyName.${provider}`)}
        hint={t(`hint.${provider}`)}
        testHint={t('testHint')}
        paste={t('paste')}
        confirmDelete={t('confirmDelete')}
        saved={keys.find((key) => key.kind === provider) ?? null}
        models={MODELS[provider]}
      />
      <ResumeMatcherStatus />
    </div>
  );
}

interface CardProps {
  kind: ApiKeyKind;
  name: string;
  hint: string;
  testHint: string;
  paste: string;
  confirmDelete: string;
  saved: ApiKey | null;
  /** For an AI key: the default model and some others, for the model box. */
  models?: { default: string; more: string[] };
}

/** One key: a Saved badge with Test, Replace and Delete when saved, a password box when not. */
export function KeyCard({
  kind,
  name,
  hint,
  testHint,
  paste,
  confirmDelete,
  saved,
  models,
}: CardProps) {
  const errorText = useErrorText();
  const t = useTranslations('Settings.keys');
  const inputId = useId();
  const modelId = useId();
  const save = useSaveApiKey();
  const remove = useDeleteApiKey();
  const test = useTestApiKey();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [model, setModel] = useState(saved?.model ?? '');
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
        {saved && !editing && (
          // A saved key is never shown again, not even its last letters: the badge says it is set.
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={button}
              disabled={test.isPending}
              onClick={() => {
                test.mutate(kind, {
                  // The job popup turns its AI parts off (or on again) from this result.
                  onSuccess: (result) => {
                    if (models) noteAiResult(result.ok, result.error);
                  },
                });
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
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              aria-label={t('deleteLabel', { name })}
              onClick={() => {
                setConfirming(true);
              }}
            >
              {t('delete')}
            </button>
          </div>
        )}
      </div>

      {confirming && saved && (
        <div
          role="alertdialog"
          aria-label={t('delete')}
          className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span className="flex-1">{confirmDelete}</span>
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
              { kind, value, model: models ? model.trim() || null : null },
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
            placeholder={paste}
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
                setModel(saved?.model ?? '');
                save.reset();
              }}
            >
              {t('cancel')}
            </button>
          )}
          {models && <ModelBox id={modelId} models={models} value={model} onChange={setModel} />}
        </form>
      )}
      {models && saved && !editing && (
        <SavedModel kind={kind} saved={saved} models={models} id={modelId} />
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

/** The model box: free text, with the default and a few others to pick from. */
function ModelBox({
  id,
  models,
  value,
  onChange,
}: {
  id: string;
  models: { default: string; more: string[] };
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('Settings.keys.ai');
  return (
    <span className="flex w-full flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-sm text-slate-700">
        {t('model')}
      </label>
      <input
        id={id}
        list={`${id}-list`}
        value={value}
        placeholder={models.default}
        spellCheck={false}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 font-mono text-sm sm:max-w-xs"
      />
      <datalist id={`${id}-list`}>
        {[models.default, ...models.more].map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <span id={`${id}-hint`} className="text-xs text-slate-500">
        {t('modelHint', { model: models.default })}
      </span>
    </span>
  );
}

/** Changes the model of a saved key without pasting the key again. */
function SavedModel({
  kind,
  saved,
  models,
  id,
}: {
  kind: ApiKeyKind;
  saved: ApiKey;
  models: { default: string; more: string[] };
  id: string;
}) {
  const errorText = useErrorText();
  const t = useTranslations('Settings.keys.ai');
  const setModel = useSetApiKeyModel();
  const [value, setValue] = useState(saved.model ?? '');
  const changed = value.trim() !== (saved.model ?? '');

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setModel.mutate({ kind, model: value.trim() || null });
      }}
    >
      <ModelBox
        id={id}
        models={models}
        value={value}
        onChange={(next) => {
          setValue(next);
          setModel.reset();
        }}
      />
      {changed && (
        <button type="submit" disabled={setModel.isPending} className={button}>
          {t('saveModel')}
        </button>
      )}
      {setModel.isSuccess && !changed && (
        <span role="status" className="text-sm text-emerald-700">
          ✓ {t('modelSaved')}
        </span>
      )}
      {setModel.isError && (
        <span role="alert" className="text-sm text-red-700">
          {errorText(setModel.error)}
        </span>
      )}
    </form>
  );
}
