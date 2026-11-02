import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { countriesIn, countryName } from '../countries';
import { splitList } from '../schema';
import { inputClass } from './Field';

interface Props {
  /** The input's id, so the field's label points at it. */
  id: string;
  /** Comma-separated codes ("DE, AT"), the same string the form keeps. Empty = worldwide. */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string | undefined;
}

/**
 * Pick several countries from JobsPipe's list, or Worldwide. Type to filter by name or code;
 * a 2-letter code that isn't in the list can still be added. Chips show what's picked.
 */
export function CountrySelect({ id, value, onChange, invalid, describedBy }: Props) {
  const t = useTranslations('AddJobs.country');
  const locale = useLocale();
  const countries = countriesIn(locale);
  const name = (code: string) => countryName(code, locale);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(0);
  const picked = splitList(value).map((c) => c.toUpperCase());

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => {
      document.removeEventListener('mousedown', close);
    };
  }, [open]);

  const query = filter.trim().toLowerCase();
  // An exact code first ("at" → Austria), then names that start with the text, then the rest.
  const rank = ([code, name]: readonly [string, string]) => {
    if (code.toLowerCase() === query) return 0;
    if (name.toLowerCase().startsWith(query)) return 1;
    return name.toLowerCase().includes(query) ? 2 : 3;
  };
  const matches = query
    ? countries.filter((c) => rank(c) < 3).sort((a, b) => rank(a) - rank(b))
    : countries;
  const typedCode = /^[a-z]{2}$/.test(query) && !matches.some(([c]) => c.toLowerCase() === query);
  const options: { code: string | null; label: string }[] = [
    ...(query ? [] : [{ code: null, label: t('worldwide') }]),
    ...matches.map(([code, label]) => ({ code, label: `${label} · ${code}` })),
    ...(typedCode
      ? [{ code: query.toUpperCase(), label: t('useCode', { code: query.toUpperCase() }) }]
      : []),
  ];

  const set = (codes: string[]) => {
    onChange(codes.join(', '));
  };
  const choose = (code: string | null) => {
    if (code === null) set([]);
    else set(picked.includes(code) ? picked.filter((c) => c !== code) : [...picked, code]);
    setFilter('');
    setActive(0);
  };

  return (
    <div ref={box} className="relative">
      <div className={`${inputClass} flex min-h-[38px] flex-wrap items-center gap-1 py-1`}>
        <ul className="contents" aria-label={t('picked')}>
          {picked.map((code) => (
            <li
              key={code}
              className="inline-flex items-center gap-1 rounded bg-brand-50 py-0.5 pr-0.5 pl-1.5 text-xs font-medium text-brand-800 ring-1 ring-brand-200 ring-inset"
            >
              {name(code)} · {code}
              <button
                type="button"
                aria-label={t('remove', { country: name(code) })}
                className="rounded px-1 leading-none hover:bg-brand-100"
                onClick={(e) => {
                  e.stopPropagation();
                  choose(code);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={filter}
          placeholder={picked.length ? t('add') : t('worldwide')}
          className="min-w-32 flex-1 border-0 p-0.5 text-sm outline-none focus:ring-0"
          onFocus={() => {
            setOpen(true);
          }}
          onChange={(e) => {
            setFilter(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              // Enter picks a country instead of submitting the form.
              if (open && options[active]) {
                e.preventDefault();
                choose(options[active].code);
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
            } else if (e.key === 'Backspace' && !filter && picked.length) {
              set(picked.slice(0, -1));
            }
          }}
        />
      </div>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={t('list')}
          aria-multiselectable
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {options.length === 0 && <p className="px-3 py-2 text-slate-500">{t('none')}</p>}
          {options.map((option, i) => {
            const selected =
              option.code === null ? picked.length === 0 : picked.includes(option.code);
            return (
              <div
                key={option.code ?? 'worldwide'}
                id={`${listId}-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={selected}
                className={`flex cursor-pointer items-center justify-between px-3 py-1.5 ${i === active ? 'bg-brand-50' : ''} ${option.code === null ? 'border-b border-slate-100 font-medium' : ''}`}
                onMouseEnter={() => {
                  setActive(i);
                }}
                onMouseDown={(e) => {
                  // Keep focus in the input, so the list stays open for the next pick.
                  e.preventDefault();
                  choose(option.code);
                }}
              >
                {option.label}
                {selected && <span className="text-brand-600">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
