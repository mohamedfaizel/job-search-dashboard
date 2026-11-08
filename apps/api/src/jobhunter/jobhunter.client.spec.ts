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

  it('turns an HTTP error into a ServiceUnavailableException', async () => {
    server.use(http.post(`${BASE_URL}/jobs/search`, () => new HttpResponse(null, { status: 401 })));
    await expect(client.searchJobs({}, 'bad')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
