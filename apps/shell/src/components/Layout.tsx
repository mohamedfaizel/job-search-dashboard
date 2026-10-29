import type { User } from '@jobsearch/data';
import type { ReactNode } from 'react';
import { useState } from 'react';

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

/**
 * The app frame. On wide screens the links sit in the header; on phones (under 768 px) they
 * fold into a ☰ menu, so the header never makes the page scroll sideways.
 */
export function Layout({ user, current, onNavigate, onLogOut, children }: Props) {
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === 'ADMIN');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <span className="font-semibold text-slate-900">Job Search</span>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="main-menu"
            aria-label="Menu"
            onClick={() => {
              setMenuOpen((open) => !open);
            }}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-xl text-slate-700 hover:bg-slate-100 md:hidden"
          >
            <span aria-hidden>{menuOpen ? '✕' : '☰'}</span>
          </button>
          <div
            id="main-menu"
            className={`${menuOpen ? 'flex' : 'hidden'} w-full flex-col gap-2 md:flex md:w-auto md:flex-row md:items-center md:gap-4`}
          >
            <nav aria-label="Main">
              <ul className="flex flex-col gap-1 md:flex-row md:gap-2">
                {items.map(({ view, label }) => (
                  <li key={view}>
                    <button
                      type="button"
                      aria-current={current === view ? 'page' : undefined}
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate(view);
                      }}
                      className="w-full rounded-md px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-100 aria-[current=page]:bg-indigo-50 aria-[current=page]:text-indigo-700 md:w-auto md:py-1.5"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 pt-2 text-sm md:border-t-0 md:border-l md:px-0 md:pt-0 md:pl-4">
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
                className="rounded-md px-2 py-2.5 text-slate-600 hover:bg-slate-100 md:py-1.5"
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
