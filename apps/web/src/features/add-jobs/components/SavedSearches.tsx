import type { SavedSearch, SyncJobsResult } from '@jobsearch/data';
import {
  useDeleteSavedSearch,
  useImportBudget,
  useRunSavedSearch,
  useSavedSearches,
  useSaveSearch,
  useSetSchedule,
} from '@jobsearch/data';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { TipButton } from '../../../components/TipButton';
import { useErrorText } from '../../../i18n/useErrorText';
import { useJobFormat } from '../../jobs/useJobFormat';
import { countryName } from '../countries';
import { useDateTime } from '../format';
import { savedSearchToForm, toSavedSearchInput } from '../schema';
import { useWarningText } from '../useWarningText';
import { SearchSettings } from './AutopilotControls';

interface Props {
  /** Put a saved search into the import form to edit it. */
  onLoad: (search: SavedSearch) => void;
  /** The search that is in the form now, marked in the list. */
  loadedId?: number | null;
}

/**
 * Your saved searches as a compact panel beside the import form. Each search is folded to three
 * short lines (what it looks for, chips for schedule / Autopilot / Kits, next and last run) with
 * ▶ Run, ✎ Edit and a ⋯ menu. Open one (▸) to change its schedule and Autopilot; one at a time.
 * On a phone it sits above the form and can be hidden.
 */
export function SavedSearches({ onLoad, loadedId = null }: Props) {
  const errorText = useErrorText();
  const { data: searches, isPending, error } = useSavedSearches();
  const { data: budget } = useImportBudget();
  const t = useTranslations('AddJobs');
  const [hidden, setHidden] = useState(false);
  // One search open at a time; the others stay folded.
  const [openId, setOpenId] = useState<number | null>(null);
  const empty = searches?.length === 0;

  return (
    <section
      aria-labelledby="saved-heading"
      className={`space-y-2 rounded-lg border bg-white p-3 ${
        empty ? 'border-dashed border-slate-400' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <h2 id="saved-heading" className="flex-1 text-sm font-semibold text-slate-900">
          {searches?.length ? t('saved.count', { count: searches.length }) : t('saved.heading')}
        </h2>
        {budget && !empty && (
          <span
            className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-slate-600"
            title={t('saved.budget', {
              used: budget.used,
              credits: t('credits', { count: budget.cap }),
            })}
          >
            <span className="sr-only">
              {t('saved.budget', {
                used: budget.used,
                credits: t('credits', { count: budget.cap }),
              })}
            </span>
            <span aria-hidden>
              {budget.used}/{budget.cap}
            </span>
            <span
              aria-hidden
              className="h-1.5 w-12 overflow-hidden rounded-full border border-slate-200 bg-slate-100"
            >
              <span
                className="block h-full bg-amber-400"
                style={{
                  width: `${Math.min(100, (budget.used / Math.max(1, budget.cap)) * 100)}%`,
                }}
              />
            </span>
          </span>
        )}
        {!empty && (
          <button
            type="button"
            aria-expanded={!hidden}
            aria-controls="saved-list"
            onClick={() => {
              setHidden((h) => !h);
            }}
            className="min-h-11 px-2 text-xs text-slate-700 lg:hidden"
          >
            {hidden ? t('saved.show') : t('saved.hide')}
          </button>
        )}
      </div>
      {isPending && <p className="text-sm text-slate-600">{t('saved.loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t('saved.loadError', { error: errorText(error) })}
        </p>
      )}
      {empty && <p className="text-sm text-slate-700">{t('saved.none')}</p>}
      <div id="saved-list" className={hidden ? 'hidden lg:block' : undefined}>
        <ul className="space-y-1.5">
          {searches?.map((search) => (
            <li key={search.id}>
              <SavedSearchRow
                search={search}
                onLoad={onLoad}
                loaded={search.id === loadedId}
                open={search.id === openId}
                onToggle={() => {
                  setOpenId((was) => (was === search.id ? null : search.id));
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** What a saved search looks for, in one line, in your language. */
function useDescribeSearch() {
  const t = useTranslations('AddJobs');
  const locale = useLocale();
  const f = useJobFormat();
  return (search: SavedSearch) => describeSearch(search, t, locale, f.language);
}

function describeSearch(
  search: SavedSearch,
  t: (key: string, values?: Record<string, string | number>) => string,
  locale: string,
  languageName: (code: string) => string,
): string {
  const extras = [
    search.languages.length
      ? t('saved.inLanguages', { languages: search.languages.map(languageName).join('/') })
      : '',
    search.remoteOnly ? t('saved.remote') : '',
    search.skipFluentGerman ? t('saved.noFluentGerman') : '',
    search.employmentTypes.map((type) => t(`jobTypes.${type}`)).join(', '),
    search.excludeTitles.length
      ? t('saved.notTitles', { titles: search.excludeTitles.join(', ') })
      : '',
    search.minSalaryEur === null ? '' : t('saved.minSalary', { amount: search.minSalaryEur }),
  ];
  const countries = search.countryCodes.map((code) => countryName(code, locale));
  return [search.boards, search.titles, search.skills, countries, search.locations]
    .filter((part) => part.length > 0)
    .map((part) => part.join(', '))
    .concat(extras.filter(Boolean))
    .join(' · ');
}

function SavedSearchRow({
  search,
  onLoad,
  loaded,
  open,
  onToggle,
}: {
  search: SavedSearch;
  onLoad: Props['onLoad'];
  loaded: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const errorText = useErrorText();
  const run = useRunSavedSearch();
  const t = useTranslations('AddJobs');
  const dateTime = useDateTime();
  const describe = useDescribeSearch();
  const [renaming, setRenaming] = useState(false);
  const last = search.lastRun;
  const free = search.source !== 'JOBHUNTER';
  const settingsId = `saved-settings-${search.id}`;
  const what = describe(search);

  return (
    <article
      aria-labelledby={`saved-${search.id}`}
      className={`space-y-1 rounded-lg border p-2 ${
        open
          ? 'border-2 border-amber-400 p-[7px]'
          : loaded
            ? 'border-brand-400 bg-brand-50'
            : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={settingsId}
          aria-label={t('saved.settingsFor', { name: search.name })}
          onClick={onToggle}
          className="grid size-6 shrink-0 place-items-center rounded text-xs text-slate-600 hover:bg-slate-100"
        >
          <span aria-hidden>{open ? '▾' : '▸'}</span>
        </button>
        {renaming ? (
          <RenameBox
            search={search}
            onDone={() => {
              setRenaming(false);
            }}
          />
        ) : (
          <h3
            id={`saved-${search.id}`}
            className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900"
          >
            <button type="button" onClick={onToggle} className="max-w-full truncate text-left">
              {search.name}
            </button>
          </h3>
        )}
        {loaded && <span className="text-[11px] text-brand-800">{t('saved.loadedNote')}</span>}
        <TipButton
          tip={run.isPending ? t('importing') : t('saved.runNow')}
          tone="plain"
          disabled={run.isPending}
          onClick={() => {
            run.mutate({ id: search.id });
          }}
        >
          <span className="text-xs text-amber-400">▶</span>
        </TipButton>
        <span className="hidden sm:contents">
          <TipButton
            tip={t('saved.editNamed', { name: search.name })}
            tone="plain"
            onClick={() => {
              onLoad(search);
            }}
          >
            <PencilIcon />
          </TipButton>
        </span>
        <SearchMenu
          search={search}
          onEdit={() => {
            onLoad(search);
          }}
          onRename={() => {
            setRenaming(true);
          }}
        />
      </div>
      <p className="truncate text-xs text-slate-600" title={what}>
        {free && (
          <>
            <span className="font-medium text-emerald-800">
              {t(search.source === 'COMPANY_BOARDS' ? 'saved.boardsBadge' : 'saved.freeBadge')}
            </span>
            {' · '}
          </>
        )}
        {what}
      </p>
      <SearchChips search={search} />
      <p className="flex justify-between gap-2 text-[11px] text-slate-600">
        <span className="truncate">
          {search.schedule !== 'OFF' && search.nextRunAt
            ? t('saved.nextShort', { date: dateTime(search.nextRunAt) })
            : last
              ? t('saved.lastRunShort', { date: dateTime(last.finishedAt) })
              : t('saved.never')}
        </span>
        {last && <span className="shrink-0">{t('saved.lastNew', { created: last.created })}</span>}
      </p>

      {run.data && <RunResult result={run.data} free={free} />}
      {run.data?.hasMore && (
        <button
          type="button"
          disabled={run.isPending}
          onClick={() => {
            run.mutate({ id: search.id, resume: true });
          }}
          className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {t('continue')}
        </button>
      )}
      {run.isError && (
        <p role="alert" className="text-xs text-red-700">
          {t('importFailed', { error: errorText(run.error) })}
        </p>
      )}

      <div id={settingsId} hidden={!open} className="space-y-1 pt-1">
        <p className="text-[11px] text-slate-600">
          {free
            ? t('saved.lastDaysFree', { days: search.maxAgeDays })
            : t('saved.lastDays', {
                days: search.maxAgeDays,
                credits: t('credits', { count: search.pageSize * search.maxPages }),
              })}
          {search.onlyNew ? t('saved.onlyNew') : ''}
        </p>
        {last && (
          <p className="text-[11px] text-slate-600">
            {t(last.creditsCharged === null || free ? 'saved.lastRun' : 'saved.lastRunCredits', {
              date: dateTime(last.finishedAt),
              created: last.created,
              updated: last.updated,
              credits: t('credits', { count: last.creditsCharged ?? 0 }),
            })}
          </p>
        )}
        {open && <SearchSettings search={search} />}
      </div>
    </article>
  );
}

/** One glance: when it runs, Autopilot's queue line, and whether it writes kits. */
function SearchChips({ search }: { search: SavedSearch }) {
  const t = useTranslations('AddJobs.saved');
  const chip = 'rounded-full px-2 py-px text-[11px] whitespace-nowrap';
  return (
    <div className="flex flex-wrap gap-1">
      <span className={`${chip} border border-slate-200 bg-slate-50 text-slate-700`}>
        {search.schedule === 'OFF'
          ? t('manualOnly')
          : t('chipSchedule', {
              when: t(`frequencyShort.${search.schedule}`),
              time: search.schedule === 'HOURLY' ? '' : search.runAt,
            }).trim()}
      </span>
      {search.autopilot && (
        <span className={`${chip} bg-amber-100 text-amber-900`}>
          {t('chipAuto', { fit: search.autoQueueFitMin })}
        </span>
      )}
      {search.autopilot && search.autoKits && (
        <span className={`${chip} bg-neutral-900 text-amber-300`}>
          {t('chipKits', { target: search.kitScoreTarget })}
        </span>
      )}
    </div>
  );
}

/** ⋯: Edit (phones), Pause schedule, Copy, Rename and Delete (asks first). */
function SearchMenu({
  search,
  onEdit,
  onRename,
}: {
  search: SavedSearch;
  onEdit: () => void;
  onRename: () => void;
}) {
  const t = useTranslations('AddJobs.saved');
  const errorText = useErrorText();
  const remove = useDeleteSavedSearch();
  const copy = useSaveSearch();
  const pause = useSetSchedule();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = `saved-menu-${search.id}`;
  const error = remove.error ?? copy.error ?? pause.error;

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setConfirming(false);
  };
  const item =
    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-100';

  return (
    <div ref={box} className="relative">
      <TipButton
        tip={t('more', { name: search.name })}
        tone="plain"
        onClick={() => {
          setOpen((o) => !o);
          setConfirming(false);
        }}
      >
        <DotsIcon />
      </TipButton>
      <div
        id={menuId}
        hidden={!open}
        className="absolute top-full right-0 z-30 mt-1 grid w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
      >
        <button
          type="button"
          className={`${item} sm:hidden`}
          onClick={() => {
            close();
            onEdit();
          }}
        >
          <span aria-hidden>✎</span>
          {t('edit')}
        </button>
        {search.schedule !== 'OFF' && (
          <button
            type="button"
            className={item}
            disabled={pause.isPending}
            onClick={() => {
              pause.mutate(
                { id: search.id, schedule: 'OFF', runAt: search.runAt },
                { onSuccess: close },
              );
            }}
          >
            <span aria-hidden>⏸</span>
            {t('pause')}
          </button>
        )}
        <button
          type="button"
          className={item}
          disabled={copy.isPending}
          onClick={() => {
            copy.mutate(
              {
                input: toSavedSearchInput(
                  t('copyName', { name: search.name }),
                  savedSearchToForm(search),
                ),
              },
              { onSuccess: close },
            );
          }}
        >
          <span aria-hidden>⧉</span>
          {t('copy')}
        </button>
        <button
          type="button"
          className={item}
          onClick={() => {
            close();
            onRename();
          }}
        >
          <span aria-hidden>✎</span>
          {t('rename')}
        </button>
        <div className="mt-0.5 border-t border-slate-200 pt-0.5">
          {confirming ? (
            <div className="grid gap-1 p-1">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(search.id);
                }}
                className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t('deleteNamed', { name: search.name })}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                }}
                className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                {t('keep')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`${item} text-red-700 hover:bg-red-50`}
              onClick={() => {
                setConfirming(true);
              }}
            >
              <span aria-hidden>🗑</span>
              {t('delete')}
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="p-1 text-xs text-red-700">
            {t('menuError', { error: errorText(error) })}
          </p>
        )}
      </div>
    </div>
  );
}

/** Rename in place: the name becomes a box with ✓ / ✕. */
function RenameBox({ search, onDone }: { search: SavedSearch; onDone: () => void }) {
  const t = useTranslations('AddJobs.saved');
  const errorText = useErrorText();
  const save = useSaveSearch();
  const [name, setName] = useState(search.name);
  const submit = () => {
    if (name.trim() === '' || name.trim() === search.name) {
      onDone();
      return;
    }
    save.mutate(
      { id: search.id, input: toSavedSearchInput(name, savedSearchToForm(search)) },
      { onSuccess: onDone },
    );
  };
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      <h3 id={`saved-${search.id}`} className="sr-only">
        {search.name}
      </h3>
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the user just asked to rename it
        autoFocus
        aria-label={t('newName')}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
          if (event.key === 'Escape') onDone();
        }}
        className="h-7 min-w-0 flex-1 rounded-md border border-slate-300 px-1.5 text-sm"
      />
      <TipButton tip={t('saveName')} tone="yes" disabled={save.isPending} onClick={submit}>
        ✓
      </TipButton>
      <TipButton tip={t('cancelAutopilot')} tone="no" onClick={onDone}>
        ✕
      </TipButton>
      {save.isError && (
        <p role="alert" className="w-full text-xs text-red-700">
          {t('menuError', { error: errorText(save.error) })}
        </p>
      )}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function RunResult({ result, free }: { result: SyncJobsResult; free: boolean }) {
  const t = useTranslations('AddJobs');
  const warningText = useWarningText();
  return (
    <div role="status" className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-800">
      <p>
        {result.resumed ? t('saved.continued') : t('saved.imported')}
        {result.fetched === 0
          ? t('saved.noNew')
          : t('saved.counts', { created: result.created, updated: result.updated })}{' '}
        {free
          ? t('saved.free')
          : t('saved.usedCredits', { credits: t('credits', { count: result.creditsCharged }) })}
        {result.hasMore && t('saved.morePages')}
      </p>
      {result.warnings.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-amber-900">
          {result.warnings.map((warning) => (
            <li key={warning}>{warningText(warning)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
