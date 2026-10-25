import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JobsPipeSearchRequest, JobsPipeSearchResponse } from './jobspipe.types';

/** Talks to the JobsPipe REST API. The token stays on the server and never reaches the browser. */
@Injectable()
export class JobsPipeClient {
  constructor(private readonly config: ConfigService) {}

  async searchJobs(body: JobsPipeSearchRequest): Promise<JobsPipeSearchResponse> {
    const token = this.config.get<string>('JOBSPIPE_API_TOKEN');
    if (!token) {
      throw new ServiceUnavailableException('JOBSPIPE_API_TOKEN is not set in .env');
    }
    const baseUrl = this.config.get<string>('JOBSPIPE_API_URL') ?? 'https://api.jobspipe.dev/v1';

    const res = await fetch(`${baseUrl}/jobs/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Don't echo the response body: it could be large, and error text is enough to debug.
      throw new ServiceUnavailableException(
        `JobsPipe search failed: ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as JobsPipeSearchResponse;
  }
}
