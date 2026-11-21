import { useTranslations } from 'next-intl';
import type { ComponentProps, ReactNode } from 'react';
import { InfoTip } from '../../../components/InfoTip';

interface Props {
  label: string;
  /** The id of the input inside, so the label and error are linked to it. */
  htmlFor: string;
  error?: string | undefined;
  hint?: string;
  /** Like `hint`, but behind a small ⓘ next to the label, to keep the form short. */
  tip?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/** Label + input + error message, wired up for screen readers. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  tip,
  required = false,
  children,
  className = '',
}: Props) {
  const t = useTranslations('AddJobs');
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-1.5">
        <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
        {tip && <InfoTip label={t('moreAbout', { field: label })} text={tip} />}
      </div>
      {children}
      {hint && !error && <p className="text-xs text-slate-600">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm aria-[invalid=true]:border-red-500';

/** A small uppercase name in front of a row of chips. */
export const GROUP_LABEL = 'text-[11px] font-semibold tracking-wide text-slate-600 uppercase';

type ChipProps = Omit<ComponentProps<'input'>, 'type' | 'className'> & {
  label: string;
};

/**
 * A checkbox drawn as a pill: black when ticked. It stays a real checkbox, so keyboards and
 * screen readers use it as one.
 */
export function ChipCheckbox({ label, ...input }: ChipProps) {
  return (
    <label className="inline-flex cursor-pointer">
      <input type="checkbox" {...input} className="peer sr-only" />
      <span className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 hover:border-slate-500">
        {label}
      </span>
    </label>
  );
}
