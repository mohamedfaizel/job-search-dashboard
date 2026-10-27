import { getErrorMessage, useLogIn, useSignUp } from '@jobsearch/data';
import type { SubmitEvent } from 'react';
import { useId, useState } from 'react';

type Mode = 'log-in' | 'sign-up';

/** A text field's value from a submitted form. */
function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/** Shown instead of the app until someone logs in. */
export function AuthPage() {
  const [mode, setMode] = useState<Mode>('log-in');
  const logIn = useLogIn();
  const signUp = useSignUp();
  const active = mode === 'log-in' ? logIn : signUp;
  const id = useId();

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = text(form, 'email');
    const password = text(form, 'password');
    if (mode === 'log-in') logIn.mutate({ email, password });
    else signUp.mutate({ name: text(form, 'name'), email, password });
  }

  function switchTo(next: Mode) {
    logIn.reset();
    signUp.reset();
    setMode(next);
  }

  const field =
    'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <main className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          {mode === 'log-in' ? 'Log in to Job Search' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === 'log-in'
            ? 'Track jobs, your applications and your profile.'
            : 'The first account on a new server becomes its admin.'}
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4"
          aria-label={mode === 'log-in' ? 'Log in' : 'Sign up'}
        >
          {active.isError && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {getErrorMessage(active.error)}
            </p>
          )}
          {mode === 'sign-up' && (
            <label htmlFor={`${id}-name`} className="block text-sm font-medium text-slate-700">
              Name
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
            Email
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
            Password
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
                At least 8 characters
              </span>
            )}
          </label>
          <button
            type="submit"
            disabled={active.isPending}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mode === 'log-in'
              ? logIn.isPending
                ? 'Logging in…'
                : 'Log in'
              : signUp.isPending
                ? 'Creating account…'
                : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {mode === 'log-in' ? 'New here? ' : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              switchTo(mode === 'log-in' ? 'sign-up' : 'log-in');
            }}
            className="font-medium text-indigo-700 hover:underline"
          >
            {mode === 'log-in' ? 'Create an account' : 'Log in'}
          </button>
        </p>
      </main>
    </div>
  );
}
