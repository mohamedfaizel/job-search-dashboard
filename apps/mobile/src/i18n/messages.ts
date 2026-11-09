/** The phone app's words, in English and German. Keys mirror the web app where they overlap. */
export const messages = {
  en: {
    App: {
      name: 'Job Search Hunter',
    },
    Auth: {
      heading: 'Log in to {app}',
      intro: 'Your jobs, Fit % and applications, on your phone.',
      email: 'Email',
      password: 'Password',
      logIn: 'Log in',
      loggingIn: 'Logging in…',
      logOut: 'Log out',
      server: 'Server: {url}',
    },
    Jobs: {
      title: 'Jobs',
      count: '{count, plural, =0 {No jobs yet} one {# job} other {# jobs}}',
      empty: 'No jobs yet. Add jobs on the website, then pull down to refresh.',
      fit: 'Fit {score}%',
      noFit: 'Fit –',
      new: 'New',
      remote: 'Remote',
      hybrid: 'Hybrid',
      onSite: 'On-site',
      loadMore: 'Show more',
      loading: 'Loading…',
    },
    Errors: {
      NETWORK:
        'Can’t reach the API at {url}. Is `pnpm dev` running on your computer, on the same Wi-Fi?',
      WRONG_LOGIN: 'Wrong email or password.',
      TOO_MANY_TRIES: 'Too many tries. Please wait {minutes} minutes and try again.',
      unknown: 'Something went wrong: {message}',
    },
  },
  de: {
    App: {
      name: 'Job Search Hunter',
    },
    Auth: {
      heading: 'Bei {app} anmelden',
      intro: 'Deine Stellen, Fit % und Bewerbungen auf dem Handy.',
      email: 'E-Mail',
      password: 'Passwort',
      logIn: 'Anmelden',
      loggingIn: 'Anmelden…',
      logOut: 'Abmelden',
      server: 'Server: {url}',
    },
    Jobs: {
      title: 'Stellen',
      count: '{count, plural, =0 {Noch keine Stellen} one {# Stelle} other {# Stellen}}',
      empty:
        'Noch keine Stellen. Füge Stellen auf der Website hinzu und zieh dann nach unten zum Aktualisieren.',
      fit: 'Fit {score} %',
      noFit: 'Fit –',
      new: 'Neu',
      remote: 'Remote',
      hybrid: 'Hybrid',
      onSite: 'Vor Ort',
      loadMore: 'Mehr zeigen',
      loading: 'Lädt…',
    },
    Errors: {
      NETWORK:
        'Die API unter {url} ist nicht erreichbar. Läuft `pnpm dev` auf deinem Computer, im selben WLAN?',
      WRONG_LOGIN: 'E-Mail oder Passwort falsch.',
      TOO_MANY_TRIES: 'Zu viele Versuche. Bitte warte {minutes} Minuten und versuche es erneut.',
      unknown: 'Etwas ist schiefgelaufen: {message}',
    },
  },
} as const;

export type Locale = keyof typeof messages;

/** The app's language: German for a German phone (or account), otherwise English. */
export function pickLocale(...wanted: (string | null | undefined)[]): Locale {
  return wanted.find((code): code is Locale => code === 'en' || code === 'de') ?? 'en';
}
