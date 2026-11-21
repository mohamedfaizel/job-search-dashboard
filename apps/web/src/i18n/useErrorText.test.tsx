import { ApiError } from '@jobsearch/data';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Intl } from '@/test/intl';
import { useErrorText } from './useErrorText';

function errorText(locale: 'en' | 'de') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Intl locale={locale}>{children}</Intl>
  );
  return renderHook(() => useErrorText(), { wrapper }).result.current;
}

/** A failed request, as the API sends it: the English message plus the code and its values. */
const failed = (code: string, params: Record<string, string> = {}) =>
  new ApiError('English text', code, params);

describe('useErrorText', () => {
  it('writes an API error in the language you picked', () => {
    expect(errorText('en')(failed('WRONG_LOGIN'))).toBe('Wrong email or password.');
    expect(errorText('de')(failed('WRONG_LOGIN'))).toBe('E-Mail oder Passwort ist falsch.');
  });

  it('fills in the values that come with the code', () => {
    const error = failed('SAVED_SEARCH_NAME_TAKEN', { name: 'Berlin' });
    expect(errorText('en')(error)).toBe('A saved search named “Berlin” already exists.');
    expect(errorText('de')(error)).toBe('Eine gespeicherte Suche namens „Berlin“ gibt es schon.');
  });

  it('writes the sentence for a failed upload', () => {
    expect(errorText('de')(failed('PHOTO_TOO_BIG'))).toBe('Das Foto ist größer als 2 MB.');
  });

  it('falls back to the API’s own message for a code it does not know', () => {
    expect(errorText('de')(failed('SOMETHING_NEW'))).toBe('English text');
    expect(errorText('de')(new ApiError('Upload failed (500)'))).toBe('Upload failed (500)');
    expect(errorText('de')(new Error('Boom'))).toBe('Boom');
  });

  it('counts saved searches right, and names a source that is down', () => {
    const full = (max: number) => new ApiError('full', 'SAVED_SEARCHES_FULL', { max });
    expect(errorText('en')(full(1))).toBe('You can keep at most 1 saved search. Delete one first.');
    expect(errorText('de')(full(5))).toBe(
      'Du kannst höchstens 5 gespeicherte Suchen behalten. Lösche zuerst eine.',
    );
    expect(errorText('en')(failed('JOBHUNTER_TOKEN_REJECTED'))).toBe(
      'JobHunter didn’t accept your token. Check it in Settings › API keys.',
    );
  });

  it('says so when the API can not be reached', () => {
    expect(errorText('en')(new TypeError('Failed to fetch'))).toBe(
      'Can’t connect right now. Check your internet, or try again in a minute.',
    );
    expect(errorText('de')(new TypeError('Failed to fetch'))).toBe(
      'Gerade keine Verbindung. Prüfe dein Internet oder versuche es in einer Minute erneut.',
    );
  });
});
