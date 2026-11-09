import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompanyBoardsClient } from './company-boards.client';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, statusText: status === 404 ? 'Not Found' : 'OK' });

describe('CompanyBoardsClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('looks a Greenhouse board up on the EU server when the main one has none', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(json({ jobs: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new CompanyBoardsClient().postings({ ats: 'greenhouse', slug: 'parloa' }),
    ).resolves.toEqual([]);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://boards-api.greenhouse.io/v1/boards/parloa/jobs?content=true',
      'https://boards-api.eu.greenhouse.io/v1/boards/parloa/jobs?content=true',
    ]);
  });

  it('says 404 when neither server has the board', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json({}, 404)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new CompanyBoardsClient().postings({ ats: 'lever', slug: 'nobody' }),
    ).rejects.toThrow('404 Not Found');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      'https://api.eu.lever.co/v0/postings/nobody?mode=json',
    );
  });

  it('does not retry Ashby, which has one server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}, 404));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new CompanyBoardsClient().postings({ ats: 'ashby', slug: 'nobody' }),
    ).rejects.toThrow('404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
