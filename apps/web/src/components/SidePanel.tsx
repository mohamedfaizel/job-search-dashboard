'use client';

import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

/**
 * A panel that slides in from the right over the page (full screen on a phone). Esc, the ✕ and
 * a click outside close it; focus moves into it and goes back to where it was.
 */
export function SidePanel({
  title,
  note,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  /** A short line next to the title. */
  note?: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      {/* The ✕ is the keyboard's way out; this is for a click beside the panel. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        className="absolute inset-0 cursor-default bg-slate-900/25"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[26rem]"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          {note && <span className="text-xs text-slate-600">{note}</span>}
          <button
            ref={close}
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="ml-auto rounded-md px-2 py-1 text-lg leading-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
