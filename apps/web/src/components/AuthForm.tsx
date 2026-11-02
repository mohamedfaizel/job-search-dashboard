'use client';

import type { User } from '@jobsearch/data';
import { useLogIn, useSetLocale, useSignUp } from '@jobsearch/data';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { SubmitEvent } from 'react';
import { useId, useRef } from 'react';
import { APP_NAME } from '@/lib/app-name';
import { safeNextPath } from '@/lib/safe-next';
import { useErrorText } from '../i18n/useErrorText';
import { LanguageSwitch } from './LanguageSwitch';
import { Logo } from './Logo';

export type AuthMode = 'log-in' | 'sign-up';

/** A text field's value from a submitted form. */
function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

const field =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500';

/**
 * The log-in and sign-up form. Each has its own page (/login, /signup), so a link can open
 * either one. After success you go back to the page you wanted (?next=/tracker).
 */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const errorText = useErrorText();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  const logIn = useLogIn();
  const signUp = useSignUp();
  const active = mode === 'log-in' ? logIn : signUp;
  const id = useId();
  const t = useTranslations('Auth');
  const locale = useLocale();
  const setLocale = useSetLocale();
  // True when you picked a language on this page: it's then saved on your account.
  const picked = useRef(false);

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = text(form, 'email');
    const password = text(form, 'password');
    const onSuccess = (user: User) => {
      if (picked.current && user.locale !== locale) setLocale.mutate(locale);
      // replace, not push: Back shouldn't return to the login form.
      router.replace(next);
    };
    if (mode === 'log-in') logIn.mutate({ email, password }, { onSuccess });
    else signUp.mutate({ name: text(form, 'name'), email, password }, { onSuccess });
  }

  // Keep ?next= when switching between the two pages.
  const otherQuery = next === '/jobs' ? {} : { next };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <main className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <Logo className="h-10 w-10" />
          <LanguageSwitch
            onPick={() => {
              picked.current = true;
            }}
          />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          {mode === 'log-in' ? t('logInHeading', { app: APP_NAME }) : t('signUpHeading')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === 'log-in' ? t('logInIntro') : t('signUpIntro')}
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4"
          aria-label={mode === 'log-in' ? t('logInTitle') : t('signUpTitle')}
        >
          {active.isError && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {errorText(active.error)}
            </p>
          )}
          {mode === 'sign-up' && (
            <label htmlFor={`${id}-name`} className="block text-sm font-medium text-slate-700">
              {t('name')}
              <input
                id={`${id}-name`}
                name="name"
                required
                maxLength={80}
                autoComplete="name"
                className={field}
              />
            </label>
          )}
          <label htmlFor={`${id}-email`} className="block text-sm font-medium text-slate-700">
            {t('email')}
            <input
              id={`${id}-email`}
              name="email"
              type="email"
              required
              autoComplete="email"
              className={field}
            />
          </label>
          <label htmlFor={`${id}-password`} className="block text-sm font-medium text-slate-700">
            {t('password')}
            <input
              id={`${id}-password`}
              name="password"
              type="password"
              required
              minLength={mode === 'sign-up' ? 8 : undefined}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              className={field}
            />
            {mode === 'sign-up' && (
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {t('passwordHint')}
              </span>
            )}
          </label>
          <button
            type="submit"
            disabled={active.isPending}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mode === 'log-in'
              ? t(logIn.isPending ? 'loggingIn' : 'logIn')
              : t(signUp.isPending ? 'creatingAccount' : 'createAccount')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {mode === 'log-in' ? t('newHere') : t('haveAccount')}{' '}
          <Link
            href={{ pathname: mode === 'log-in' ? '/signup' : '/login', query: otherQuery }}
            className="font-medium text-indigo-700 hover:underline"
          >
            {mode === 'log-in' ? t('createAnAccount') : t('logIn')}
          </Link>
        </p>
      </main>
    </div>
  );
}
