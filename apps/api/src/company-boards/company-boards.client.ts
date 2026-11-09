import { Injectable } from '@nestjs/common';
import { fromAshby, fromGreenhouse, fromLever } from './board-feeds';
import type {
  AshbyFeed,
  BoardPosting,
  BoardRef,
  GreenhouseFeed,
  LeverPosting,
} from './company-boards.types';

/**
 * Greenhouse and Lever keep European companies on their own servers: a board that is not on the
 * main one (404) is looked up there too.
 */
const EU_HOSTS: Record<string, string> = {
  'boards-api.greenhouse.io': 'boards-api.eu.greenhouse.io',
  'api.lever.co': 'api.eu.lever.co',
};

/** Reads a company's public career-page feed. Free: no account, no key. */
@Injectable()
export class CompanyBoardsClient {
  private async getJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const eu = res.status === 404 ? EU_HOSTS[new URL(url).hostname] : undefined;
      if (eu) {
        const next = new URL(url);
        next.hostname = eu;
        return this.getJson<T>(next.toString());
      }
      // Don't echo the body: the status line is enough to debug.
      throw new Error(`${res.status} ${res.statusText}`.trim());
    }
    return (await res.json()) as T;
  }

  async postings({ ats, slug }: BoardRef): Promise<BoardPosting[]> {
    const name = encodeURIComponent(slug);
    switch (ats) {
      case 'greenhouse':
        return fromGreenhouse(
          await this.getJson<GreenhouseFeed>(
            `https://boards-api.greenhouse.io/v1/boards/${name}/jobs?content=true`,
          ),
        );
      case 'lever': {
        const feed = await this.getJson<LeverPosting[]>(
          `https://api.lever.co/v0/postings/${name}?mode=json`,
        );
        return fromLever(Array.isArray(feed) ? feed : []);
      }
      case 'ashby':
        return fromAshby(
          await this.getJson<AshbyFeed>(`https://api.ashbyhq.com/posting-api/job-board/${name}`),
        );
    }
  }
}
