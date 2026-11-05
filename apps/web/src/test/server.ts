import type { Notifications, User } from '@jobsearch/data';
import { API_URL } from '@jobsearch/data';
import { HttpResponse } from 'msw';
import { graphql } from 'msw/graphql';
import { setupServer } from 'msw/node';

export const api = graphql.link(API_URL);

export const ADMIN: User = {
  id: 1,
  email: 'mohamed@example.com',
  name: 'Mohamed',
  role: 'ADMIN',
  locale: 'en',
};

/** Languages saved with setLocale, in order. */
export const savedLocales: string[] = [];

/** The fake API's bell list. Tests put notifications in it. */
export const bell: Notifications = { items: [], unread: 0 };

/** The fake API's session: who the cookie says is logged in. */
export const session: { user: User | null } = { user: null };

export const server = setupServer(
  api.query('Me', () => HttpResponse.json({ data: { me: session.user } })),
  api.mutation('LogIn', ({ variables }) => {
    const input = variables['input'] as { email: string; password: string };
    if (input.password !== 'correct horse') {
      return HttpResponse.json({ errors: [{ message: 'Wrong email or password' }] });
    }
    session.user = ADMIN;
    return HttpResponse.json({ data: { logIn: ADMIN } });
  }),
  api.mutation('SignUp', ({ variables }) => {
    const input = variables['input'] as { name: string; email: string };
    session.user = { id: 2, email: input.email, name: input.name, role: 'USER', locale: 'en' };
    return HttpResponse.json({ data: { signUp: session.user } });
  }),
  api.mutation('SetLocale', ({ variables }) => {
    const locale = variables['locale'] as string;
    savedLocales.push(locale);
    if (session.user) session.user = { ...session.user, locale };
    return HttpResponse.json({ data: { setLocale: session.user } });
  }),
  api.query('Notifications', () => HttpResponse.json({ data: { notifications: bell } })),
  api.mutation('MarkNotificationsRead', () => {
    const count = bell.unread;
    bell.items = bell.items.map((item) => ({ ...item, readAt: item.readAt ?? 'now' }));
    bell.unread = 0;
    return HttpResponse.json({ data: { markNotificationsRead: count } });
  }),
  api.mutation('LogOut', () => {
    session.user = null;
    return HttpResponse.json({ data: { logOut: true } });
  }),
);
