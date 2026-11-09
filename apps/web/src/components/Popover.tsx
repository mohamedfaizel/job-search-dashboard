'use client';

import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * A button that opens a small panel under it, for a toolbar. A click outside or Esc closes it.
 * The panel stays mounted while closed, so what you typed in it is still there next time.
 */
export function Popover({
  label,
  buttonClass,
  panelClass = '',
  align = 'left',
  children,
}: {
  label: ReactNode;
  buttonClass: string;
  panelClass?: string;
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((o) => !o);
        }}
        className={buttonClass}
      >
        {label}
        <span aria-hidden className={`ml-1 inline-block text-[10px] ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={`absolute top-full z-30 mt-1 rounded-lg border border-slate-200 bg-white p-3 shadow-lg ${
          align === 'right' ? 'right-0' : 'left-0'
        } ${panelClass}`}
      >
        {children}
      </div>
    </div>
  );
}
