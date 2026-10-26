import type { ReactNode } from 'react';

export type BadgeTone = 'gray' | 'red' | 'orange' | 'purple' | 'blue' | 'green' | 'pink';

const TONES: Record<BadgeTone, string> = {
  gray: 'bg-slate-50 text-slate-700 ring-slate-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pink: 'bg-pink-50 text-pink-700 ring-pink-200',
};

interface Props {
  tone?: BadgeTone;
  children: ReactNode;
  title?: string;
}

export function Badge({ tone = 'gray', children, title }: Props) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-48 items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TONES[tone]}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
