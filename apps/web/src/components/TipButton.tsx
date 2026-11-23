import type { ReactNode } from 'react';
import { useId } from 'react';

const TONES = {
  yes: 'text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50',
  no: 'text-red-600 hover:border-red-300 hover:bg-red-50',
  plain: 'text-slate-700 hover:bg-slate-50',
} as const;

/**
 * A square ✓ / ✕ / icon button whose tooltip shows on hover and on keyboard focus (a plain
 * `title` waits a second and never shows for keyboard users). The tooltip is its name for
 * screen readers too.
 */
export function TipButton({
  tip,
  tone,
  onClick,
  disabled,
  children,
}: {
  tip: string;
  tone: keyof typeof TONES;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const tipId = useId();
  return (
    <button
      type="button"
      aria-label={tip}
      aria-describedby={tipId}
      disabled={disabled}
      onClick={onClick}
      className={`group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-base font-bold disabled:opacity-50 ${TONES[tone]}`}
    >
      <span aria-hidden="true">{children}</span>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none absolute right-0 bottom-full z-20 mb-1.5 hidden rounded bg-slate-900 px-2 py-1 text-xs font-semibold whitespace-nowrap text-white shadow group-hover:block group-focus-visible:block"
      >
        {tip}
      </span>
    </button>
  );
}

/** ⇄: give to someone else. */
export function SwapIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3" />
    </svg>
  );
}
