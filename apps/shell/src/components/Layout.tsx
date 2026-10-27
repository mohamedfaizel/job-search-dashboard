import type { User } from '@jobsearch/data';
import type { ReactNode } from 'react';

export type View = 'dashboard' | 'tracker' | 'add-job' | 'profile';

const NAV_ITEMS: { view: View; label: string; adminOnly?: boolean }[] = [
  { view: 'dashboard', label: 'Job posts' },
  { view: 'tracker', label: 'Tracker' },
  // Imports spend the server's JobsPipe credits, so only the admin sees this page.
  { view: 'add-job', label: 'Add jobs', adminOnly: true },
  { view: 'profile', label: 'My profile' },
];

interface Props {
  user: User;
  current: View;
  onNavigate: (view: View) => void;
  onLogOut: () => void;
  children: ReactNode;
}

export function Layout({ user, current, onNavigate, onLogOut, children }: Props) {
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === 'ADMIN');

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <span className="font-semibold text-slate-900">Job Search</span>
          <div className="flex items-center gap-4">
            <nav aria-label="Main">
              <ul className="flex gap-2">
                {items.map(({ view, label }) => (
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
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4 text-sm">
              <span className="text-slate-700" title={user.email}>
                {user.name}
                {user.role === 'ADMIN' && (
                  <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    admin
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={onLogOut}
                className="rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
