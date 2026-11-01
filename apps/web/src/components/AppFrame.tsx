'use client';

import type { User } from '@jobsearch/data';
import { getErrorMessage, useLogOut, useMe, useSetLocale } from '@jobsearch/data';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { isLocale, writeLocaleCookie } from '@/i18n/config';
import { APP_NAME } from '@/lib/app-name';
import { LanguageSwitch } from './LanguageSwitch';
import { Logo } from './Logo';

interface NavItem {
  href: string;
  /** The key of its text in messages/<locale>.json, under "Nav". */
  label: 'jobs' | 'tracker' | 'addJobs' | 'profile';
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/jobs', label: 'jobs' },
  { href: '/tracker', label: 'tracker' },
  // Imports spend the server's JobsPipe credits, so only the admin sees this page.
  { href: '/jobs/add', label: 'addJobs', adminOnly: true },
  { href: '/profile', label: 'profile' },
];

/** The link for the page you are on: the longest one that matches (/jobs/add, not /jobs). */
function currentHref(pathname: string, items: NavItem[]): string | undefined {
  return items
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/**
 * Every logged-in page sits in this frame. It asks the API who you are; when the cookie has
 * expired, the API says nobody, and you go to /login.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { data: user, isPending, error } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const logOut = useLogOut();
  // Set when you click "Log out", so you land on a plain /login (no ?next=).
  const loggingOut = useRef(false);
  const locale = useLocale();
  const t = useTranslations('Nav');

  // Your account remembers your language: on another device (or after logging in), switch to it.
  useEffect(() => {
    if (!user || user.locale === locale || !isLocale(user.locale)) return;
    writeLocaleCookie(user.locale);
    router.refresh();
  }, [user, locale, router]);

  useEffect(() => {
    if (isPending || error || user) return;
    router.replace(loggingOut.current ? '/login' : `/login?next=${encodeURIComponent(pathname)}`);
  }, [isPending, error, user, router, pathname]);

  if (error) {
    return (
      <p role="alert" className="p-6 text-sm text-red-700">
        {getErrorMessage(error)}
      </p>
    );
  }
  if (!user) return <p className="p-6 text-sm text-slate-500">{t('loading')}</p>;

  return (
    <TopBar
      user={user}
      pathname={pathname}
      loggingOut={logOut.isPending}
      onLogOut={() => {
        loggingOut.current = true;
        logOut.mutate();
      }}
    >
      {children}
    </TopBar>
  );
}

interface TopBarProps {
  user: User;
  pathname: string;
  loggingOut: boolean;
  onLogOut: () => void;
  children: ReactNode;
}

/**
 * The header with the main links. On phones (under 768 px) the links fold into a ☰ menu, so
 * the header never makes the page scroll sideways.
 */
export function TopBar({ user, pathname, loggingOut, onLogOut, children }: TopBarProps) {
  const t = useTranslations('Nav');
  const setLocale = useSetLocale();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === 'ADMIN');
  const current = currentHref(pathname, items);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link href="/jobs" className="flex items-center gap-2 font-semibold text-slate-900">
            <Logo />
            {APP_NAME}
          </Link>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="main-menu"
            aria-label={t('menu')}
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
            <nav aria-label={t('main')}>
              <ul className="flex flex-col gap-1 md:flex-row md:gap-2">
                {items.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={current === href ? 'page' : undefined}
                      onClick={() => {
                        setMenuOpen(false);
                      }}
                      className="block w-full rounded-md px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-100 aria-[current=page]:bg-indigo-50 aria-[current=page]:text-indigo-700 md:w-auto md:py-1.5"
                    >
                      {t(label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 pt-2 text-sm md:border-t-0 md:border-l md:px-0 md:pt-0 md:pl-4">
              <span className="text-slate-700" title={user.email}>
                {user.name}
                {user.role === 'ADMIN' && (
                  <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    {t('admin')}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <LanguageSwitch
                  onPick={(picked) => {
                    setLocale.mutate(picked);
                  }}
                />
                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={onLogOut}
                  className="rounded-md px-2 py-2.5 text-slate-600 hover:bg-slate-100 disabled:opacity-50 md:py-1.5"
                >
                  {t('logOut')}
                </button>
              </span>
            </div>
          </div>
        </div>
      </header>
      <main className="px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
