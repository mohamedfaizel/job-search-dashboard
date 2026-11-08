import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JobHunterSearchRequest, JobHunterSearchResponse } from './jobhunter.types';

/**
 * Talks to the JobHunter REST API with the caller's own token (Settings > API keys). The token
 * stays on the server and never reaches the browser.
 */
@Injectable()
export class JobHunterClient {
  constructor(private readonly config: ConfigService) {}

  async searchJobs(body: JobHunterSearchRequest, token: string): Promise<JobHunterSearchResponse> {
    const baseUrl = this.config.get<string>('JOBHUNTER_API_URL') ?? 'https://api.jobspipe.dev/v1';

    const res = await fetch(`${baseUrl}/jobs/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Don't echo the response body: it could be large, and error text is enough to debug.
      throw new ServiceUnavailableException(
        `JobHunter search failed: ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as JobHunterSearchResponse;
  }
}
