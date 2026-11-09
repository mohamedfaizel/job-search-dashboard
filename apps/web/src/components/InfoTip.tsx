import { useId } from 'react';

/**
 * A small ⓘ that shows its text on hover and on keyboard focus: details that would make a form
 * long stay one tap or hover away. Screen readers read the text as the button's description.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const tipId = useId();
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tipId}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] leading-none font-semibold text-slate-500 hover:border-slate-600 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        i
      </button>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-20 mt-1 w-64 -translate-x-1/2 rounded bg-slate-900 px-2.5 py-1.5 text-xs font-normal text-white opacity-0 shadow transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
