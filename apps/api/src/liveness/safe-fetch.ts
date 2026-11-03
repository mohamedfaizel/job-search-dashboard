import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { FetchedPage } from './judge';

/** Thrown when the link may not be opened (not http/https, or it points inside our network). */
export class UnsafeUrlError extends Error {}

/** True for loopback, private, link-local and other addresses a public job ad never uses. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (isIP(ip) === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return (
      ip === '::' ||
      ip === '::1' ||
      ip.startsWith('fc') ||
      ip.startsWith('fd') ||
      ip.startsWith('fe8') ||
      ip.startsWith('fe9') ||
      ip.startsWith('fea') ||
      ip.startsWith('feb')
    );
  }
  return false;
}

/** Refuses links that aren't http(s), or whose host is (or resolves to) a private address. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Not a valid link');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http and https links are checked');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new UnsafeUrlError('Local links are not checked');
  }
  const addresses = isIP(host.replace(/^\[|\]$/g, ''))
    ? [host]
    : (await lookup(host, { all: true })).map((entry) => entry.address);
  if (addresses.some(isPrivateAddress)) throw new UnsafeUrlError('Local links are not checked');
  return url;
}

export interface FetchOptions {
  timeoutMs: number;
  /** Most bytes of the page to read. Job ads fit easily; this stops a huge download. */
  maxBytes?: number;
  maxRedirects?: number;
}

const HEADERS = {
  // A normal browser User-Agent: many job sites answer 403 to anything else.
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en,de;q=0.8',
};

async function readText(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    chunks.push(chunk.value);
    size += chunk.value.byteLength;
    if (size >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * Opens a job link like a browser would, following redirects by hand so every hop is checked
 * with assertPublicUrl (a public link can't redirect us into the server's own network).
 */
export async function fetchPage(
  link: string,
  { timeoutMs, maxBytes = 1_000_000, maxRedirects = 5 }: FetchOptions,
): Promise<FetchedPage> {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = link;
  for (let hop = 0; ; hop += 1) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, { headers: HEADERS, redirect: 'manual', signal });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location && hop < maxRedirects) {
      await res.body?.cancel();
      current = new URL(location, url).href;
      continue;
    }
    return {
      status: res.status,
      url: link,
      finalUrl: url.href,
      body: await readText(res, maxBytes),
    };
  }
}
