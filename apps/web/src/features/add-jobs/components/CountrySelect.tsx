import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { splitList } from '../../../lib/split-list';
import { countriesIn, countryName } from '../countries';
import type { Region } from '../regions';
import { REGIONS, groupPicked, pickedIn } from '../regions';
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

/** One row of the list: Worldwide, a region (several countries at once) or one country. */
type Option =
  | { kind: 'world'; key: string; label: string }
  | { kind: 'region'; key: string; label: string; region: Region }
  | { kind: 'country'; key: string; label: string; code: string };

/**
 * Pick several countries from JobHunter's list, whole regions (DACH, European Union, Middle
 * East…), or Worldwide. Regions sit at the top of the list. Type to filter by name or code; a
 * 2-letter code that isn't in the list can still be added. Chips show what's picked, with a
 * complete region as one chip.
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
  const regionName = (region: Region) => t(`region.${region.id}`);
  // A region matches on the start of any word of its name ("mid", "gulf") or its key ("eu").
  const regionMatches = (region: Region) =>
    region.id.toLowerCase() === query ||
    regionName(region)
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .some((word) => word.startsWith(query));
  const regions = REGIONS.filter((region) => !query || regionMatches(region));
  const worldOptions: Option[] = query
    ? []
    : [{ kind: 'world', key: 'world', label: t('worldwide') }];
  const regionOptions: Option[] = regions.map((region) => ({
    kind: 'region',
    key: `region-${region.id}`,
    label: regionName(region),
    region,
  }));
  const countryOptions: Option[] = [
    ...matches.map(([code, label]) => ({
      kind: 'country' as const,
      key: code,
      label: `${label} · ${code}`,
      code,
    })),
    ...(typedCode
      ? [
          {
            kind: 'country' as const,
            key: `typed-${query}`,
            label: t('useCode', { code: query.toUpperCase() }),
            code: query.toUpperCase(),
          },
        ]
      : []),
  ];
  const options = [...worldOptions, ...regionOptions, ...countryOptions];

  const set = (codes: string[]) => {
    onChange(codes.join(', '));
  };
  const toggleRegion = (region: Region) => {
    if (pickedIn(region, picked) === region.codes.length) {
      set(picked.filter((c) => !region.codes.includes(c)));
    } else {
      set([...picked, ...region.codes.filter((c) => !picked.includes(c))]);
    }
  };
  const choose = (option: Option) => {
    if (option.kind === 'world') set([]);
    else if (option.kind === 'region') toggleRegion(option.region);
    else
      set(
        picked.includes(option.code)
          ? picked.filter((c) => c !== option.code)
          : [...picked, option.code],
      );
    setFilter('');
    setActive(0);
  };
  const isSelected = (option: Option) =>
    option.kind === 'world'
      ? picked.length === 0
      : option.kind === 'region'
        ? pickedIn(option.region, picked) === option.region.codes.length
        : picked.includes(option.code);
  const chips = groupPicked(picked);
  const chipClass =
    'inline-flex items-center gap-1 rounded py-0.5 pr-0.5 pl-1.5 text-xs font-medium ring-1 ring-inset';

  /** One row of the list. `index` counts across every section, for the arrow keys. */
  const renderOption = (option: Option, index: number) => {
    const selected = isSelected(option);
    const partial = option.kind === 'region' && !selected ? pickedIn(option.region, picked) : 0;
    return (
      <div
        key={option.key}
        id={`${listId}-${index}`}
        role="option"
        tabIndex={-1}
        aria-selected={selected}
        className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 ${index === active ? 'bg-brand-50' : ''} ${option.kind === 'world' ? 'border-b border-slate-100 font-medium' : ''} ${option.kind === 'region' ? 'font-medium' : ''}`}
        onMouseEnter={() => {
          setActive(index);
        }}
        onMouseDown={(e) => {
          // Keep focus in the input, so the list stays open for the next pick.
          e.preventDefault();
          choose(option);
        }}
      >
        <span>{option.label}</span>
        <span className="flex shrink-0 items-center gap-2">
          {option.kind === 'region' && (
            <span className="text-xs font-normal text-slate-600">
              {partial
                ? t('regionPartial', { picked: partial, count: option.region.codes.length })
                : t('regionCount', { count: option.region.codes.length })}
            </span>
          )}
          {selected && <span className="text-brand-600">✓</span>}
        </span>
      </div>
    );
  };

  return (
    <div ref={box} className="relative">
      <div className={`${inputClass} flex min-h-[34px] flex-wrap items-center gap-1 py-1`}>
        <ul className="contents" aria-label={t('picked')}>
          {chips.regions.map((region) => (
            <li
              key={`region-${region.id}`}
              className={`${chipClass} bg-brand-100 text-slate-900 ring-brand-400`}
            >
              {regionName(region)} · {region.codes.length}
              <button
                type="button"
                aria-label={t('remove', { country: regionName(region) })}
                className="rounded px-1 leading-none hover:bg-brand-200"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRegion(region);
                }}
              >
                ×
              </button>
            </li>
          ))}
          {chips.countries.map((code) => (
            <li key={code} className={`${chipClass} bg-brand-50 text-brand-800 ring-brand-200`}>
              {name(code)} · {code}
              <button
                type="button"
                aria-label={t('remove', { country: name(code) })}
                className="rounded px-1 leading-none hover:bg-brand-100"
                onClick={(e) => {
                  e.stopPropagation();
                  set(picked.filter((c) => c !== code));
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
          className="h-6 min-w-32 flex-1 border-0 p-0.5 text-sm leading-5 outline-none focus:ring-0"
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
                choose(options[active]);
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
          className="absolute z-30 mt-1 max-h-80 w-full min-w-64 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {options.length === 0 && <p className="px-3 py-2 text-slate-600">{t('none')}</p>}
          {worldOptions.map((option, i) => renderOption(option, i))}
          {regionOptions.length > 0 && (
            <div role="group" aria-labelledby={`${listId}-regions`}>
              <p
                id={`${listId}-regions`}
                role="presentation"
                className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-600 uppercase"
              >
                {t('regions')}
              </p>
              {regionOptions.map((option, i) => renderOption(option, worldOptions.length + i))}
            </div>
          )}
          {countryOptions.length > 0 && (
            <div
              role="group"
              aria-labelledby={`${listId}-countries`}
              className={regionOptions.length ? 'mt-1 border-t border-slate-100' : ''}
            >
              <p
                id={`${listId}-countries`}
                role="presentation"
                className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-600 uppercase"
              >
                {t('countries')}
              </p>
              {countryOptions.map((option, i) =>
                renderOption(option, worldOptions.length + regionOptions.length + i),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
