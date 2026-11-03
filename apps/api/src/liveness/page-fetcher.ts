import { Injectable } from '@nestjs/common';
import type { FetchedPage } from './judge';
import { fetchPage } from './safe-fetch';

/** Opens job links. Its own class so tests can swap it for a fake without real network calls. */
@Injectable()
export class PageFetcher {
  get(url: string, timeoutMs: number): Promise<FetchedPage> {
    return fetchPage(url, { timeoutMs });
  }
}
