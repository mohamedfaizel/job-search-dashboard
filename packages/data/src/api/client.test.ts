import { ClientError } from 'graphql-request';
import { describe, expect, it } from 'vitest';
import { ApiError, apiErrorFrom, getErrorCode } from './client';

const failed = (extensions?: Record<string, unknown>) =>
  new ClientError({ status: 200, errors: [{ message: 'English text', extensions }] } as never, {
    query: '',
  });

describe('getErrorCode', () => {
  it('reads the code and values of a failed GraphQL request', () => {
    const error = failed({ apiCode: 'RESUME_TOO_LONG', apiParams: { max: 20000 } });
    expect(getErrorCode(error)).toEqual({ code: 'RESUME_TOO_LONG', params: { max: 20000 } });
  });

  it('uses empty values when the API sent none', () => {
    expect(getErrorCode(failed({ apiCode: 'WRONG_LOGIN' }))).toEqual({
      code: 'WRONG_LOGIN',
      params: {},
    });
  });

  it('reads the code of a failed upload', () => {
    const error = new ApiError('English text', 'PHOTO_TYPE', { a: 1 });
    expect(getErrorCode(error)).toEqual({ code: 'PHOTO_TYPE', params: { a: 1 } });
  });

  it('returns null for errors that have no code', () => {
    expect(getErrorCode(failed({ code: 'INTERNAL_SERVER_ERROR' }))).toBeNull();
    expect(getErrorCode(failed())).toBeNull();
    expect(getErrorCode(new ApiError('English text'))).toBeNull();
    expect(getErrorCode(new Error('Boom'))).toBeNull();
  });
});

describe('apiErrorFrom', () => {
  it('builds an error from the body of a failed upload', () => {
    const error = apiErrorFrom(
      { message: 'Too big', code: 'PHOTO_TOO_BIG', params: { mb: 2 } },
      'x',
    );
    expect(error).toMatchObject({ message: 'Too big', code: 'PHOTO_TOO_BIG', params: { mb: 2 } });
  });

  it('uses the fallback text when the body has no message', () => {
    expect(apiErrorFrom(null, 'Upload failed (500)').message).toBe('Upload failed (500)');
    expect(apiErrorFrom({ message: ['a', 'b'] }, 'Upload failed (400)').message).toBe(
      'Upload failed (400)',
    );
  });
});
