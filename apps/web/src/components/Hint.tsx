import type { ReactNode } from 'react';

/**
 * A short label with a tooltip on hover: "Queue ≥" shows "Jobs with this Fit % or more go to
 * your Apply queue." The tip is for the eye only; the field next to it carries the full name for
 * screen readers. Hidden (display:none) until hovered, so it can't widen the page.
 */
export function Hint({
  tip,
  children,
  align = 'left',
}: {
  tip: string;
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <span className="group/hint relative inline-flex cursor-help">
      {children}
      <span
        aria-hidden
        className={`pointer-events-none absolute bottom-full z-30 mb-1 hidden w-max max-w-56 rounded bg-slate-900 px-2 py-1 text-[11px] leading-snug font-normal whitespace-normal text-white shadow group-hover/hint:block ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {tip}
      </span>
    </span>
  );
}
