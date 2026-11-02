import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { API_ERROR_CODES, apiError, withApiError } from './api-error';

const messages = (locale: string) =>
  JSON.parse(readFileSync(join(__dirname, `../../../web/messages/${locale}.json`), 'utf8')) as {
    Errors: Record<string, string>;
  };

describe('API error codes', () => {
  it.each(['en', 'de'])('have a sentence in %s on the web app', (locale) => {
    const { Errors } = messages(locale);
    expect(API_ERROR_CODES.filter((code) => !Errors[code])).toEqual([]);
  });

  it('keeps the English message next to the code and values', () => {
    const error = apiError(BadRequestException, 'RESUME_TOO_LONG', 'Too long', { max: 5 });
    expect(error.message).toBe('Too long');
    expect(error.getResponse()).toEqual({
      message: 'Too long',
      code: 'RESUME_TOO_LONG',
      params: { max: 5 },
    });
  });

  it('copies the code into the GraphQL error, and leaves other errors alone', () => {
    const coded = apiError(BadRequestException, 'EMAIL_TAKEN', 'Taken');
    const formatted = { message: 'Taken', extensions: { code: 'X' } };
    expect(withApiError(formatted, { originalError: coded }).extensions).toEqual({
      code: 'X',
      apiCode: 'EMAIL_TAKEN',
      apiParams: {},
    });
    expect(withApiError(formatted, { originalError: new Error('boom') })).toBe(formatted);
    expect(withApiError(formatted, undefined)).toBe(formatted);
  });
});
