import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadSearchResponse } from '../../test/fixtures/load';
import { JobHunterClient } from './jobhunter.client';

const BASE_URL = 'https://jobhunter.test/v1';

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

const client = new JobHunterClient(new ConfigService({ JOBHUNTER_API_URL: BASE_URL }));

describe('JobHunterClient', () => {
  it('sends the token and search body, and returns the response', async () => {
    let seen: { auth: string | null; body: unknown } | undefined;
    server.use(
      http.post(`${BASE_URL}/jobs/search`, async ({ request }) => {
        seen = { auth: request.headers.get('authorization'), body: await request.json() };
        return HttpResponse.json(loadSearchResponse());
      }),
    );

    const res = await client.searchJobs({ job_title_or: ['frontend'], limit: 3 }, 'jp_test_123');

    expect(seen).toEqual({
      auth: 'Bearer jp_test_123',
      body: { job_title_or: ['frontend'], limit: 3 },
    });
    expect(res.data).toHaveLength(3);
  });

  const codeOf = async (status: number) => {
    server.use(http.post(`${BASE_URL}/jobs/search`, () => new HttpResponse(null, { status })));
    const error: unknown = await client.searchJobs({}, 'bad').catch((e: unknown) => e);
    return (error as { getResponse(): { code: string } }).getResponse().code;
  };

  it('says in plain words when the token is wrong, or the credits are used up', async () => {
    expect(await codeOf(401)).toBe('JOBHUNTER_TOKEN_REJECTED');
    expect(await codeOf(403)).toBe('JOBHUNTER_TOKEN_REJECTED');
    expect(await codeOf(402)).toBe('JOBHUNTER_NO_CREDITS');
  });

  it('turns other HTTP errors, and no answer at all, into SOURCE_DOWN', async () => {
    server.use(http.post(`${BASE_URL}/jobs/search`, () => new HttpResponse(null, { status: 500 })));
    await expect(client.searchJobs({}, 'x')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(await codeOf(503)).toBe('SOURCE_DOWN');
    server.use(http.post(`${BASE_URL}/jobs/search`, () => HttpResponse.error()));
    await expect(client.searchJobs({}, 'x')).rejects.toMatchObject({
      message: "JobHunter isn't answering right now. Try again in a few minutes.",
    });
  });
});
