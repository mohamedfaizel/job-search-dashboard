import type { ReactNode } from 'react';

interface Props {
  label: string;
  /** The id of the input inside, so the label and error are linked to it. */
  htmlFor: string;
  error?: string | undefined;
  hint?: string;
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
  required = false,
  children,
  className = '',
}: Props) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
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
