import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadSearchResponse } from '../../test/fixtures/load';
import { JobsPipeClient } from './jobspipe.client';

const BASE_URL = 'https://jobspipe.test/v1';

// MSW intercepts fetch() calls, so the real client runs without hitting the network.
const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function clientWith(token: string | undefined) {
  return new JobsPipeClient(
    new ConfigService({ JOBSPIPE_API_URL: BASE_URL, JOBSPIPE_API_TOKEN: token }),
  );
}

describe('JobsPipeClient', () => {
  it('sends the token and search body, and returns the response', async () => {
    let seen: { auth: string | null; body: unknown } | undefined;
    server.use(
      http.post(`${BASE_URL}/jobs/search`, async ({ request }) => {
        seen = { auth: request.headers.get('authorization'), body: await request.json() };
        return HttpResponse.json(loadSearchResponse());
      }),
    );

    const res = await clientWith('jp_test_123').searchJobs({
      job_title_or: ['frontend'],
      limit: 3,
    });

    expect(seen).toEqual({
      auth: 'Bearer jp_test_123',
      body: { job_title_or: ['frontend'], limit: 3 },
    });
    expect(res.data).toHaveLength(3);
  });

  it('fails clearly when the token is missing', async () => {
    await expect(clientWith(undefined).searchJobs({})).rejects.toThrow('JOBSPIPE_API_TOKEN');
  });

  it('turns an HTTP error into a ServiceUnavailableException', async () => {
    server.use(http.post(`${BASE_URL}/jobs/search`, () => new HttpResponse(null, { status: 401 })));
    await expect(clientWith('bad').searchJobs({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
