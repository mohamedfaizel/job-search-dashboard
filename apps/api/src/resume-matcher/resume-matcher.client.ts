import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RmHealthResponse, RmStatusResponse } from './resume-matcher.types';

/** The health check is instant; the status check waits for one small AI call. */
const HEALTH_TIMEOUT_MS = 5_000;
const STATUS_TIMEOUT_MS = 30_000;

/**
 * Talks to Resume-Matcher's REST API. Resume-Matcher has no logins of its own, so only this
 * server calls it: the browser never sees its address, and every request has already passed
 * our own login check.
 */
@Injectable()
export class ResumeMatcherClient {
  constructor(private readonly config: ConfigService) {}

  /** False when RESUME_MATCHER_URL is not set, so the feature can stay switched off. */
  get isConfigured(): boolean {
    return this.baseUrl !== null;
  }

  health(): Promise<RmHealthResponse> {
    return this.get<RmHealthResponse>('/health', HEALTH_TIMEOUT_MS);
  }

  status(): Promise<RmStatusResponse> {
    return this.get<RmStatusResponse>('/status', STATUS_TIMEOUT_MS);
  }

  private get baseUrl(): string | null {
    const url = this.config.get<string>('RESUME_MATCHER_URL')?.trim();
    return url ? url.replace(/\/+$/, '') : null;
  }

  private async get<T>(path: string, timeoutMs: number): Promise<T> {
    const baseUrl = this.baseUrl;
    if (!baseUrl) {
      throw new ServiceUnavailableException('RESUME_MATCHER_URL is not set in .env');
    }

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/v1${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      // Connection refused (container stopped) or the timeout fired.
      const reason =
        error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'is not reachable';
      throw new ServiceUnavailableException(`Resume-Matcher at ${baseUrl} ${reason}`);
    }

    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Resume-Matcher ${path} failed: ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as T;
  }
}
