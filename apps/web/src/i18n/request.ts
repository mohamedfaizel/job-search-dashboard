import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { isLocale, LOCALE_COOKIE, localeFromHeader, TIME_ZONE } from './config';

/**
 * next-intl calls this on the server for every request: which language, and its texts.
 * The language comes from the cookie, so the URLs stay the same in every language.
 */
export default getRequestConfig(async () => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved)
    ? saved
    : localeFromHeader((await headers()).get('accept-language'));
  const messages = (await import(`../../messages/${locale}.json`)) as {
    default: Record<string, unknown>;
  };
  return { locale, messages: messages.default, timeZone: TIME_ZONE };
});
