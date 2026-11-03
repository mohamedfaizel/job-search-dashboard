import { HttpException } from '@nestjs/common';
import type { GraphQLFormattedError } from 'graphql';

/**
 * Every error the screens can show has a code. The web app turns the code into a sentence in
 * the language you picked (messages/*.json, "Errors"); the English `message` is only the fallback
 * for a code the web app doesn't know yet, and what logs and API clients read.
 */
export const API_ERROR_CODES = [
  'LOGIN_REQUIRED',
  'ADMIN_ONLY',
  'SIGNUP_CLOSED',
  'EMAIL_TAKEN',
  'WRONG_LOGIN',
  'LOCALE_UNKNOWN',
  'JOB_NOT_FOUND',
  'SALARY_ORDER',
  'FILE_REQUIRED',
  'PHOTO_REQUIRED',
  'RESUME_FILE_TYPE',
  'RESUME_NO_TEXT',
  'RESUME_EMPTY',
  'RESUME_TOO_LONG',
  'INTERVIEW_PREP_EMPTY',
  'INTERVIEW_PREP_TOO_LONG',
  'MASTER_RESUME_FIRST',
  'LANGUAGE_UNKNOWN',
  'LANGUAGE_IS_MASTER',
  'JOB_RESUME_FILE_TYPE',
  'JOB_RESUME_MISSING',
  'COVER_LETTER_MISSING',
  'TERM_LENGTH',
  'NOT_IN_QUEUE',
  'QUEUE_REPLY_EMPTY',
  'SAVED_SEARCH_NOT_FOUND',
  'SAVED_SEARCH_NAME_TAKEN',
  'NOTHING_TO_CONTINUE',
  'INVALID_BOARD',
  'NO_BOARDS',
  'TAILOR_FIRST',
  'NO_COVER_LETTER',
  'JOB_NO_DESCRIPTION',
  'MATCHER_RESUME_FIRST',
  'MATCHER_FILE_FIRST',
  'MATCHER_BUSY',
  'PHOTO_TYPE',
  'PHOTO_TOO_BIG',
  'PHOTO_MISSING',
  'DOCX_TEMPLATE_FIRST',
  'DOCX_NOT_WORD',
  'GMAIL_NOT_CONFIGURED',
  'GMAIL_ACCOUNT_NOT_FOUND',
  'SUGGESTION_NOT_FOUND',
  'SUGGESTION_ANSWERED',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Values a message can use, e.g. { max: 20000 } for "at most {max} characters". */
export type ApiErrorParams = Record<string, string | number>;

/**
 * Builds a Nest exception that carries a code (and its values) next to the English message:
 * `throw apiError(NotFoundException, 'JOB_NOT_FOUND', `Job ${id} not found`, { id })`.
 */
export function apiError<T extends HttpException>(
  Exception: new (body: object) => T,
  code: ApiErrorCode,
  message: string,
  params: ApiErrorParams = {},
): T {
  return new Exception({ message, code, params });
}

/**
 * Apollo's formatError: copies the code and values of an `apiError` into the error's
 * `extensions` (`apiCode`, `apiParams`), so the web app can pick the right sentence.
 */
export function withApiError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const thrown = (error as { originalError?: unknown } | undefined)?.originalError;
  const body = thrown instanceof HttpException ? thrown.getResponse() : undefined;
  if (typeof body !== 'object' || !('code' in body)) return formatted;
  const { code, params } = body as { code: string; params?: ApiErrorParams };
  return {
    ...formatted,
    extensions: { ...formatted.extensions, apiCode: code, apiParams: params ?? {} },
  };
}
