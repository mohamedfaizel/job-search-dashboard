'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Popover } from '../../../components/Popover';
import { splitList } from '../../../lib/split-list';

/** Chips shown before "+ N more": about two rows on a laptop. */
const FOLDED = 12;

const CHIP = 'inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-sm';
const MISSING = 'border-[1.5px] border-dashed border-amber-700 bg-amber-50 text-amber-900';
const PLAIN = 'border border-slate-300 bg-white text-slate-800';

/**
 * A comma list (skills, keywords) as chips you add with Enter and remove with ✕. Chips your
 * resume does not mention are dashed; the "N not in resume" pill opens them as one line to copy.
 * Long lists show the first two rows, then "+ N more". The value stays "React, Vue, SAP".
 */
export function ChipList({
  label,
  addLabel,
  value,
  missing,
  hint,
  error,
  onChange,
}: {
  label: string;
  /** "Add a skill, press Enter": the add box's name and placeholder. */
  addLabel: string;
  value: string;
  /** The items your resume never mentions. */
  missing: string[];
  hint?: string;
  error?: string | undefined;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('Profile.chips');
  const headingId = useId();
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const items = splitList(value);
  const lower = new Set(missing.map((m) => m.toLowerCase()));
  const shown = all ? items : items.slice(0, FOLDED);

  const add = () => {
    const known = new Set(items.map((i) => i.toLowerCase()));
    const fresh = splitList(draft).filter((item) => {
      const key = item.toLowerCase();
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    setDraft('');
    if (fresh.length) onChange([...items, ...fresh].join(', '));
  };
  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index).join(', '));
  };

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="font-semibold text-slate-900">
          {label}
        </h3>
        <span className="text-xs text-slate-600">{items.length}</span>
        {missing.length > 0 && (
          <div className="ml-auto">
            <Popover
              align="right"
              label={t('notInResume', { count: missing.length })}
              buttonClass="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
              panelClass="w-[min(22rem,85vw)] space-y-2"
            >
              <p className="text-sm text-slate-700">{t('copyHint')}</p>
              <textarea
                readOnly
                rows={3}
                aria-label={t('copyList', { field: label })}
                value={missing.join(', ')}
                className="block w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-sm"
              />
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  void navigator.clipboard.writeText(missing.join(', ')).then(() => {
                    setCopied(true);
                  });
                }}
              >
                {copied ? t('copied') : t('copy')}
              </button>
            </Popover>
          </div>
        )}
      </div>
      <input
        id={inputId}
        value={draft}
        aria-label={addLabel}
        placeholder={addLabel}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          // Enter adds a chip instead of sending the form.
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm aria-[invalid=true]:border-red-500"
      />
      {items.length > 0 && (
        <ul aria-label={label} className="flex flex-wrap items-center gap-1.5">
          {shown.map((item, index) => {
            const off = lower.has(item.toLowerCase());
            return (
              <li key={`${item}-${String(index)}`} className={`${CHIP} ${off ? MISSING : PLAIN}`}>
                {item}
                {off && <span className="sr-only">({t('missingTag')})</span>}
                <button
                  type="button"
                  aria-label={t('remove', { item })}
                  onClick={() => {
                    remove(index);
                  }}
                  className="rounded-full px-1 text-xs text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                >
                  ✕
                </button>
              </li>
            );
          })}
          {items.length > FOLDED && (
            <li>
              <button
                type="button"
                aria-expanded={all}
                onClick={() => {
                  setAll((a) => !a);
                }}
                className="px-1 text-sm font-medium text-brand-700 hover:underline"
              >
                {all ? t('fewer') : t('more', { count: items.length - FOLDED })}
              </button>
            </li>
          )}
        </ul>
      )}
      {hint && !error && <p className="text-xs text-slate-600">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
