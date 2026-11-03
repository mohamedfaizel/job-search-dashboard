import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertPublicUrl, fetchPage, UnsafeUrlError } from './safe-fetch';

const { lookup } = vi.hoisted(() => ({
  lookup:
    vi.fn<(host: string, options: unknown) => Promise<{ address: string; family: number }[]>>(),
}));
vi.mock('node:dns/promises', () => ({ lookup }));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  lookup.mockResolvedValue([{ address: '93.184.215.14', family: 4 }]);
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  lookup.mockReset();
});

describe('assertPublicUrl', () => {
  it('accepts a public https link', async () => {
    await expect(assertPublicUrl('https://jobs.example.com/1')).resolves.toBeInstanceOf(URL);
  });

  it('refuses bad links, other protocols and local hosts', async () => {
    await expect(assertPublicUrl('not a link')).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertPublicUrl('http://localhost:3000/')).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertPublicUrl('http://db.internal/')).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertPublicUrl('http://10.0.0.5/')).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertPublicUrl('http://[::1]/')).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('refuses a name that resolves to a private address', async () => {
    lookup.mockResolvedValue([{ address: '192.168.1.10', family: 4 }]);
    await expect(assertPublicUrl('https://sneaky.example.com/')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });
});

describe('fetchPage', () => {
  it('follows redirects and reads the page', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/jobs/2' } }))
      .mockResolvedValueOnce(new Response('<p>Hello</p>', { status: 200 }));

    const page = await fetchPage('https://jobs.example.com/jobs/1', { timeoutMs: 1000 });

    expect(page).toEqual({
      status: 200,
      url: 'https://jobs.example.com/jobs/1',
      finalUrl: 'https://jobs.example.com/jobs/2',
      body: '<p>Hello</p>',
    });
  });

  it('stops reading a huge page at maxBytes', async () => {
    const chunk = new TextEncoder().encode('x'.repeat(60));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        if (sent > 100) controller.close();
        else controller.enqueue(chunk);
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(stream, { status: 200 }));
    const page = await fetchPage('https://jobs.example.com/big', {
      timeoutMs: 1000,
      maxBytes: 100,
    });
    expect(page.body.length).toBeLessThan(6000);
    expect(page.body.length).toBeLessThanOrEqual(120);
    expect(page.body.length).toBeGreaterThanOrEqual(100);
  });

  it('refuses a redirect into a private network', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }),
    );
    await expect(
      fetchPage('https://jobs.example.com/1', { timeoutMs: 1000 }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('returns an empty body when there is none', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const page = await fetchPage('https://jobs.example.com/1', { timeoutMs: 1000 });
    expect(page).toMatchObject({ status: 204, body: '' });
  });
});
