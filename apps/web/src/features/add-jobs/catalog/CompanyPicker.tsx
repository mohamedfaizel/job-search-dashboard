import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { splitBoards } from '../schema';
import type { CatalogGroup } from './companies';
import { CATALOG_GROUPS, COMPANY_CATALOG } from './companies';

const CHIP =
  'rounded-full border px-3 py-1 text-xs font-medium aria-pressed:border-brand-600 aria-pressed:bg-brand-50 aria-pressed:text-brand-700 border-slate-300 text-slate-600 hover:bg-slate-50';

/** Boards in the text box, compared without case: "Greenhouse:Stripe" is "greenhouse:stripe". */
const keyOf = (board: string) => board.trim().toLowerCase();

interface Props {
  /** The boards field's text: "greenhouse:stripe, lever:netflix". */
  value: string;
  onChange: (value: string) => void;
}

/**
 * "Pick from 120+ companies": a list of companies whose career pages we can read, to tick
 * instead of typing greenhouse:name by hand. Search by name or place, show one group, or add a
 * whole group. Ticks write to the same text box, so typed boards stay as they are.
 */
export function CompanyPicker({ value, onChange }: Props) {
  const t = useTranslations('AddJobs.picker');
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<CatalogGroup | null>(null);

  const chosen = splitBoards(value);
  const has = new Set(chosen.map(keyOf));
  const write = (boards: string[]) => {
    onChange(boards.join(', '));
  };
  const toggle = (board: string) => {
    write(has.has(board) ? chosen.filter((b) => keyOf(b) !== board) : [...chosen, board]);
  };

  const q = query.trim().toLowerCase();
  const shown = COMPANY_CATALOG.filter(
    (c) =>
      (group === null || c.group === group) &&
      (!q || c.name.toLowerCase().includes(q) || c.place.toLowerCase().includes(q)),
  );
  const missing = shown.filter((c) => !has.has(c.board));

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen(!open);
        }}
        className="text-sm font-medium text-brand-700 hover:underline"
      >
        {open ? t('close') : t('open', { count: COMPANY_CATALOG.length })}
      </button>
      {open && (
        <div id={listId} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              aria-label={t('search')}
              placeholder={t('search')}
              className="h-8 w-48 rounded-md border border-slate-300 bg-white px-2 text-sm"
            />
            <button
              type="button"
              aria-pressed={group === null}
              onClick={() => {
                setGroup(null);
              }}
              className={CHIP}
            >
              {t('all')}
            </button>
            {CATALOG_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={group === g}
                onClick={() => {
                  setGroup(g);
                }}
                className={CHIP}
              >
                {t(`groups.${g}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-600">
              {t('chosen', { count: COMPANY_CATALOG.filter((c) => has.has(c.board)).length })}
            </span>
            {missing.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  write([...chosen, ...missing.map((c) => c.board)]);
                }}
                className="font-medium text-brand-700 hover:underline"
              >
                {t('addShown', { count: missing.length })}
              </button>
            )}
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-slate-500">{t('none')}</p>
          ) : (
            <ul className="grid max-h-72 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((c) => (
                <li key={c.board}>
                  <label className="flex items-center gap-2 py-0.5 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={has.has(c.board)}
                      onChange={() => {
                        toggle(c.board);
                      }}
                      className="size-4 rounded border-slate-300 text-brand-600"
                    />
                    <span>{c.name}</span>
                    <span className="text-xs text-slate-500">{c.place}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">{t('hint')}</p>
        </div>
      )}
    </div>
  );
}
