'use client';

import type { User } from '@jobsearch/data';
import { useSetLocale } from '@jobsearch/data';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useInstallApp } from '@/lib/install-app';
import { useDismiss } from '@/lib/use-dismiss';
import { LanguageSwitch } from './LanguageSwitch';
import {
  AdminIcon,
  InstallIcon,
  LanguageIcon,
  LogOutIcon,
  ProfileIcon,
  SettingsIcon,
} from './NavIcons';

/** Everything you can reach in the open menu, top to bottom. */
function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return Array.from(menu?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
}

/**
 * ↓ and ↑ move through the menu (and wrap), Home and End jump to the first and last item. ↓ on
 * the avatar opens the menu on its first item. Tab still works as before.
 */
function moveFocus(event: { key: string; preventDefault(): void }, menu: HTMLElement | null) {
  const items = menuItems(menu);
  if (!items.length) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next: Record<string, number> = {
    ArrowDown: at < 0 ? 0 : (at + 1) % items.length,
    ArrowUp: at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length,
    Home: 0,
    End: items.length - 1,
  };
  const index = next[event.key];
  if (index === undefined) return;
  event.preventDefault();
  items[index]?.focus();
}

/** "Mohamed Faizel" → "MF"; one word → its first letter; an empty name → "?". */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return letters || '?';
}

const ITEM =
  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-100';

/**
 * The round avatar at the right of the header. It opens your account menu: My profile,
 * Settings, Admin (for admins), the language and Log out, so the header itself stays short.
 */
export function AccountMenu({
  user,
  loggingOut,
  onLogOut,
}: {
  user: User;
  loggingOut: boolean;
  onLogOut: () => void;
}) {
  const t = useTranslations('Nav');
  const setLocale = useSetLocale();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // ↓ on the closed avatar: open, then focus the first item once the menu is drawn.
  const focusFirst = useRef(false);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useDismiss(open, box, close);
  useEffect(() => {
    const element = menu.current;
    if (!open || !element) return;
    const onKey = (event: KeyboardEvent) => {
      moveFocus(event, element);
    };
    element.addEventListener('keydown', onKey);
    return () => {
      element.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const app = useInstallApp();

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="account-menu"
        aria-label={t('account', { initials: initialsOf(user.name), name: user.name })}
        title={user.name}
        onClick={() => {
          setOpen((was) => !was);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          if (open) moveFocus(event, menu.current);
          else {
            focusFirst.current = true;
            setOpen(true);
          }
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white ring-2 ring-neutral-700 hover:ring-brand-400 aria-expanded:ring-brand-400"
      >
        {initialsOf(user.name)}
      </button>
      {open && (
        <div
          ref={(element) => {
            menu.current = element;
            if (element && focusFirst.current) {
              focusFirst.current = false;
              menuItems(element)[0]?.focus();
            }
          }}
          id="account-menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl"
        >
          <div className="border-b border-slate-100 px-2.5 pt-1 pb-2">
            <p className="font-semibold text-slate-900">
              {user.name}
              {user.role === 'ADMIN' && (
                <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                  {t('admin')}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <nav aria-label={t('accountMenu')} className="py-1">
            <Link href="/profile" onClick={close} className={ITEM}>
              <ProfileIcon className="h-4 w-4 text-slate-500" />
              {t('profile')}
            </Link>
            <Link href="/settings" onClick={close} className={ITEM}>
              <SettingsIcon className="h-4 w-4 text-slate-500" />
              {t('settings')}
            </Link>
            {user.role === 'ADMIN' && (
              <Link href="/admin" onClick={close} className={ITEM}>
                <AdminIcon className="h-4 w-4 text-slate-500" />
                {t('adminPage')}
              </Link>
            )}
            {app.state === 'prompt' && (
              <button
                type="button"
                onClick={() => {
                  close();
                  void app.install();
                }}
                className={ITEM}
              >
                <InstallIcon className="h-4 w-4 text-slate-500" />
                {t('install')}
              </button>
            )}
            {app.state === 'ios' && (
              <p className="flex items-start gap-2.5 px-2.5 py-2 text-xs text-slate-600">
                <InstallIcon className="h-4 w-4 shrink-0 text-slate-500" />
                {t('installIos')}
              </p>
            )}
          </nav>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-2 text-sm">
            <span className="flex items-center gap-2.5">
              <LanguageIcon className="h-4 w-4 text-slate-500" />
              {t('language')}
            </span>
            <LanguageSwitch
              onPick={(picked) => {
                setLocale.mutate(picked);
              }}
            />
          </div>
          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              disabled={loggingOut}
              onClick={onLogOut}
              className={`${ITEM} text-red-700 hover:bg-red-50 disabled:opacity-50`}
            >
              <LogOutIcon className="h-4 w-4" />
              {t('logOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
