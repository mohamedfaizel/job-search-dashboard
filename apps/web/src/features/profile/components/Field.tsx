import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { InfoTip } from '../../../components/InfoTip';

interface Props {
  label: string;
  /** Small text after the label, e.g. "not in resume: SAP". */
  note?: ReactNode;
  /** The id of the input inside, so the label and error are linked to it. */
  htmlFor: string;
  error?: string | undefined;
  hint?: string;
  /** Like `hint`, but behind a small ⓘ next to the label, for compact forms. */
  tip?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/** Label + input + error message, wired up for screen readers. */
export function Field({
  label,
  note,
  htmlFor,
  error,
  hint,
  tip,
  required = false,
  children,
  className = '',
}: Props) {
  const t = useTranslations('Profile');
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
        {tip && <InfoTip label={t('moreAbout', { field: label })} text={tip} />}
        {/* Outside the label, so the field's name stays "Skills". */}
        {note && <span className="text-xs text-amber-700">{note}</span>}
      </div>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm aria-[invalid=true]:border-red-500';
