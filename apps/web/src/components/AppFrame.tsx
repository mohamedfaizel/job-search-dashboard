'use client';

import type { User } from '@jobsearch/data';
import { useLogOut, useMe } from '@jobsearch/data';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { isLocale, writeLocaleCookie } from '@/i18n/config';
import { AiNameIntl } from '@/lib/ai-chat';
import { APP_NAME } from '@/lib/app-name';
import { MessageWindowHost } from '../features/messages/MessageOpener';
import { isNetworkError, useErrorText } from '../i18n/useErrorText';
import { openMessageWindow } from '../lib/message-window';
import { AccountMenu } from './AccountMenu';
import { FlagStripe } from './FlagStripe';
import { Logo } from './Logo';
import {
  HelpIcon,
  InfoIcon,
  JobsIcon,
  PlusIcon,
  ResumeIcon,
  SettingsIcon,
  TrackerIcon,
} from './NavIcons';
import { NotificationBell } from './NotificationBell';
import { ServerDown } from './ServerDown';

interface NavItem {
  href: string;
  /** The key of its text in messages/<locale>.json, under "Nav". */
  label: 'jobs' | 'tracker' | 'resume' | 'addJobs';
  icon: (props: { className?: string }) => ReactNode;
}

/** The main pages. Settings is the gear next to the 🔔; My profile lives in the avatar menu. */
const NAV_ITEMS: NavItem[] = [
  { href: '/jobs', label: 'jobs', icon: JobsIcon },
  { href: '/tracker', label: 'tracker', icon: TrackerIcon },
  // Your master resume, section by section, with a live PDF.
  { href: '/resume', label: 'resume', icon: ResumeIcon },
];

// Everyone can add jobs: JobHunter imports use your own token (Settings > API keys).
const ADD_JOBS: NavItem = { href: '/jobs/add', label: 'addJobs', icon: PlusIcon };

/** Every link the header knows, so "the page you are on" also works for the account pages. */
const ALL_HREFS = [
  ...NAV_ITEMS.map((item) => item.href),
  ADD_JOBS.href,
  '/profile',
  '/settings',
  '/admin',
  '/about',
];

/** The first-login steps' page. */
const WELCOME = '/welcome';

/** The link for the page you are on: the longest one that matches (/jobs/add, not /jobs). */
function currentHref(pathname: string): string | undefined {
  return ALL_HREFS.filter((href) => pathname === href || pathname.startsWith(`${href}/`)).sort(
    (a, b) => b.length - a.length,
  )[0];
}

/**
 * Every logged-in page sits in this frame. It asks the API who you are; when the cookie has
 * expired, the API says nobody, and you go to /login.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const errorText = useErrorText();
  const { data: user, isPending, error, refetch, isFetching } = useMe();
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);
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

  // A new account starts with the first-login steps (your key, then your resume).
  useEffect(() => {
    if (user?.onboarded === false && pathname !== WELCOME) router.replace(WELCOME);
  }, [user, pathname, router]);

  // The API says nobody is logged in, but the browser may still hold the old session cookie (it
  // expired, or an admin switched the account off or deleted it). The server only checks that the
  // cookie is there, so it would send you from /login straight back here, and the page would hang
  // on "Loading…". Logging out first clears that cookie.
  const clearingCookie = useRef(false);
  const { mutate: clearSession } = logOut;
  useEffect(() => {
    if (isPending || error || user) return;
    if (loggingOut.current) {
      router.replace('/login');
      return;
    }
    if (clearingCookie.current) return;
    clearingCookie.current = true;
    const toLogin = () => {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    };
    clearSession(undefined, { onSettled: toLogin });
  }, [isPending, error, user, router, pathname, clearSession]);

  // The API is down (or there is no internet): a friendly page that tries again by itself.
  if (error && isNetworkError(error)) return <ServerDown onRetry={retry} retrying={isFetching} />;
  if (error) {
    return (
      <p role="alert" className="p-6 text-sm text-red-700">
        {errorText(error)}
      </p>
    );
  }
  if (!user) return <p className="p-6 text-sm text-slate-600">{t('loading')}</p>;

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

/** The Settings gear: a dark box that turns gold on its page. */
const GEAR =
  'flex h-10 w-10 items-center justify-center rounded-md bg-neutral-800 text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-[current=page]:bg-brand-400 aria-[current=page]:text-black';

/** An icon in the same dark box as the Settings gear, with its name as a tooltip: ? and i. */
function HeaderIcon({
  href,
  label,
  current,
  children,
}: {
  href: string;
  label: string;
  current: string | undefined;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={current === href ? 'page' : undefined}
      className={GEAR}
    >
      {children}
    </Link>
  );
}

const PILL =
  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white aria-[current=page]:bg-brand-400 aria-[current=page]:font-semibold aria-[current=page]:text-black';

/**
 * The header: a black bar with a red and gold stripe under it, the German flag. Left: the logo
 * and the main pages (the one you are on is a gold pill). Right: a gold "+ Job Market", the 🔔,
 * the Settings gear, ? (opens the small message window), i (About us) and your avatar, which opens My
 * profile, Settings, the language and Log out. There is no footer.
 *
 * On phones (under 768 px) the main pages move to a tab bar at the bottom, like a phone app.
 */
function TopBar({ user, pathname, loggingOut, onLogOut, children }: TopBarProps) {
  const t = useTranslations('Nav');
  const current = currentHref(pathname);
  const AddIcon = ADD_JOBS.icon;

  return (
    <div className="min-h-screen">
      {/* The first Tab stop: keyboard users jump past the top bar to the page itself. */}
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-brand-400 px-3 py-2 text-sm font-semibold text-black focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('skip')}
      </a>
      <header className="bg-flag-black text-white">
        <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link
            href="/jobs"
            className="flex shrink-0 items-center gap-2 rounded-md font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            <Logo onDark className="h-9 w-9" />
            {/* Phones show only the logo, so the ?, i and the other icons fit on one line. */}
            <span className="sr-only sm:not-sr-only">{APP_NAME}</span>
          </Link>
          <nav aria-label={t('main')} className="ml-4 hidden md:block">
            <ul className="flex gap-1">
              {NAV_ITEMS.map(({ href, label, icon: ItemIcon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={current === href ? 'page' : undefined}
                    className={PILL}
                  >
                    <ItemIcon className="h-4 w-4" />
                    {t(label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              href={ADD_JOBS.href}
              aria-current={current === ADD_JOBS.href ? 'page' : undefined}
              className="hidden items-center gap-1 rounded-md bg-brand-400 px-3 py-1.5 text-sm font-semibold text-black hover:bg-brand-300 aria-[current=page]:ring-2 aria-[current=page]:ring-white md:flex"
            >
              <AddIcon className="h-4 w-4" />
              {t('addJobs')}
            </Link>
            <NotificationBell />
            <Link
              href="/settings"
              aria-label={t('settings')}
              title={t('settings')}
              aria-current={current === '/settings' ? 'page' : undefined}
              className={GEAR}
            >
              <SettingsIcon className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={openMessageWindow}
              aria-label={t('help')}
              title={t('help')}
              className={GEAR}
            >
              <HelpIcon className="h-5 w-5" />
            </button>
            <HeaderIcon href="/about" label={t('about')} current={current}>
              <InfoIcon className="h-5 w-5" />
            </HeaderIcon>
            <AccountMenu user={user} loggingOut={loggingOut} onLogOut={onLogOut} />
          </div>
        </div>
      </header>
      <FlagStripe afterBlack />
      <main
        id="main"
        tabIndex={-1}
        className="px-4 pt-6 pb-[calc(1.5rem+var(--tabbar))] focus:outline-none sm:px-6"
      >
        <AiNameIntl>{children}</AiNameIntl>
      </main>
      <MessageWindowHost />
      <PhoneTabs current={current} />
    </div>
  );
}

/** The phone tab bar: the main pages and + Job Market, each an icon with a short label. */
function PhoneTabs({ current }: { current: string | undefined }) {
  const t = useTranslations('Nav');
  return (
    <nav
      id="phone-tabs"
      aria-label={t('tabs')}
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-brand-400 bg-flag-black pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-16 grid-cols-4">
        {[...NAV_ITEMS, ADD_JOBS].map(({ href, label, icon: TabIcon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={current === href ? 'page' : undefined}
              className="flex h-full flex-col items-center justify-center gap-1 text-[11px] text-neutral-400 hover:text-white aria-[current=page]:font-semibold aria-[current=page]:text-brand-400"
            >
              <TabIcon className="h-6 w-6" />
              {t(href === ADD_JOBS.href ? 'add' : label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
