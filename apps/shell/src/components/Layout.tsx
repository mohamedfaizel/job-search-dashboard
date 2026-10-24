import type { ReactNode } from 'react';

export type View = 'dashboard' | 'add-job';

const NAV_ITEMS: { view: View; label: string }[] = [
  { view: 'dashboard', label: 'Job posts' },
  { view: 'add-job', label: 'Add a job' },
];

interface Props {
  current: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
}

export function Layout({ current, onNavigate, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <span className="font-semibold text-slate-900">Job Search</span>
          <nav aria-label="Main">
            <ul className="flex gap-2">
              {NAV_ITEMS.map(({ view, label }) => (
                <li key={view}>
                  <button
                    type="button"
                    aria-current={current === view ? 'page' : undefined}
                    onClick={() => {
                      onNavigate(view);
                    }}
                    className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 aria-[current=page]:bg-indigo-50 aria-[current=page]:text-indigo-700"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
