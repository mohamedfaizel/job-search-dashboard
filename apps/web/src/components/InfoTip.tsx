import { useId } from 'react';

/**
 * A small ⓘ that shows its text on hover and on keyboard focus: details that would make a form
 * long stay one tap or hover away. Screen readers read the text as the button's description.
 * The tip is display:none until shown, so a hidden tip near the screen edge can't widen the page.
 * It uses a named group (`group/tip`), so a parent that is also a `group` (like a <details> fold)
 * can't open it when you hover or type in a field next to it.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const tipId = useId();
  return (
    <span className="group/tip relative inline-flex align-middle">
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
        className="pointer-events-none absolute top-full left-1/2 z-20 mt-1 hidden w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded bg-slate-900 px-2.5 py-1.5 text-xs font-normal text-white shadow group-focus-within/tip:block group-hover/tip:block"
      >
        {text}
      </span>
    </span>
  );
}
