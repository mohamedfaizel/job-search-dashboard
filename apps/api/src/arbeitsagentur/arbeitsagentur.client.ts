import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BaDetail, BaSearchResponse } from './arbeitsagentur.types';

/** What we ask the search for. `days` is "published in the last N days". */
export interface BaSearch {
  what: string;
  where?: string | undefined;
  days: number;
  page: number;
  size: number;
  /** vz = full-time, tz = part-time, ho = home office possible. */
  workTime?: ('vz' | 'tz' | 'ho')[];
}

/** The key the public job search app sends. It is published in the API's documentation. */
const PUBLIC_API_KEY = 'jobboerse-jobsuche';
const DEFAULT_URL = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service';

/** Talks to the Federal Employment Agency's job board. Free: no account, no credits. */
@Injectable()
export class ArbeitsagenturClient {
  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (this.config.get<string>('ARBEITSAGENTUR_API_URL') ?? DEFAULT_URL).replace(/\/+$/, '');
  }

  private async get<T>(path: string, params?: URLSearchParams): Promise<T> {
    const query = params?.size ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}${path}${query}`, {
      headers: { 'X-API-Key': PUBLIC_API_KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      // Don't echo the body: the status line is enough to debug.
      throw new Error(`Arbeitsagentur request failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  search(query: BaSearch): Promise<BaSearchResponse> {
    const params = new URLSearchParams({
      was: query.what,
      // 1 = a job (not training or self-employment).
      angebotsart: '1',
      veroeffentlichtseit: String(query.days),
      page: String(query.page),
      size: String(query.size),
    });
    if (query.where) params.set('wo', query.where);
    if (query.workTime?.length) params.set('arbeitszeit', query.workTime.join(';'));
    return this.get<BaSearchResponse>('/pc/v4/jobs', params);
  }

  /** The full ad. The reference number goes into the path in base64. */
  detail(refnr: string): Promise<BaDetail> {
    const id = Buffer.from(refnr, 'utf8').toString('base64');
    return this.get<BaDetail>(`/pc/v4/jobdetails/${encodeURIComponent(id)}`);
  }
}
