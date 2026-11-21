import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { apiError } from '../common/api-error';
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
    }).catch(() => {
      throw sourceDown();
    });

    // Plain words for the person; the status code is in the message for whoever reads the logs.
    if (res.status === 401 || res.status === 403) {
      throw apiError(
        BadRequestException,
        'JOBHUNTER_TOKEN_REJECTED',
        `JobHunter didn't accept your token (${res.status}). Check it in Settings › API keys.`,
      );
    }
    if (res.status === 402) {
      throw apiError(
        BadRequestException,
        'JOBHUNTER_NO_CREDITS',
        'Your JobHunter account has no credits left (402).',
      );
    }
    if (!res.ok) throw sourceDown(res.status);
    return (await res.json()) as JobHunterSearchResponse;
  }
}

/** JobHunter didn't answer, or answered with an error of its own. */
function sourceDown(status?: number) {
  return apiError(
    ServiceUnavailableException,
    'SOURCE_DOWN',
    `JobHunter isn't answering right now${status ? ` (${status})` : ''}. Try again in a few minutes.`,
    { source: 'JobHunter' },
  );
}
