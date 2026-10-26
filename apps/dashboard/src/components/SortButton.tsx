import type { SortDirection } from '@jobsearch/data';
import type { ReactNode } from 'react';

interface Props {
  direction: SortDirection | null;
  onClick: () => void;
  children: ReactNode;
}

/** Column header label that sorts when clicked. The arrow shows the current direction. */
export function SortButton({ direction, onClick, children }: Props) {
  const arrow = direction === 'ASC' ? '↑' : direction === 'DESC' ? '↓' : '↕';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded font-medium whitespace-nowrap hover:text-slate-900"
    >
      {children}
      <span aria-hidden="true" className={direction ? 'text-indigo-600' : 'text-slate-300'}>
        {arrow}
      </span>
    </button>
  );
}
