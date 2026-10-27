import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  RmHealthResponse,
  RmResumeUploadResponse,
  RmStatusResponse,
} from './resume-matcher.types';

/** The health check is instant; the status check waits for one small AI call. */
const HEALTH_TIMEOUT_MS = 5_000;
const STATUS_TIMEOUT_MS = 30_000;
/** An upload waits while Resume-Matcher's AI reads the resume into sections. */
const UPLOAD_TIMEOUT_MS = 180_000;
const DELETE_TIMEOUT_MS = 15_000;

/** Resume-Matcher answered, but with an error status. `detail` is its own message. */
export class ResumeMatcherHttpError extends ServiceUnavailableException {
  constructor(
    readonly path: string,
    readonly rmStatus: number,
    readonly detail: string | null,
  ) {
    super(`Resume-Matcher ${path} failed: ${rmStatus}${detail ? ` (${detail})` : ''}`);
  }
}

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
    return this.request<RmHealthResponse>('GET', '/health', HEALTH_TIMEOUT_MS);
  }

  status(): Promise<RmStatusResponse> {
    return this.request<RmStatusResponse>('GET', '/status', STATUS_TIMEOUT_MS);
  }

  /** Sends a PDF or Word file; Resume-Matcher stores it as a master resume and reads it. */
  uploadResume(file: { name: string; type: string; bytes: Uint8Array }) {
    const body = new FormData();
    body.append('file', new Blob([file.bytes], { type: file.type }), file.name);
    return this.request<RmResumeUploadResponse>('POST', '/resumes/upload', UPLOAD_TIMEOUT_MS, body);
  }

  async deleteResume(resumeId: string): Promise<void> {
    await this.request('DELETE', `/resumes/${encodeURIComponent(resumeId)}`, DELETE_TIMEOUT_MS);
  }

  private get baseUrl(): string | null {
    const url = this.config.get<string>('RESUME_MATCHER_URL')?.trim();
    return url ? url.replace(/\/+$/, '') : null;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    timeoutMs: number,
    body?: FormData,
  ): Promise<T> {
    const baseUrl = this.baseUrl;
    if (!baseUrl) {
      throw new ServiceUnavailableException('RESUME_MATCHER_URL is not set in .env');
    }

    let res: Response;
    try {
      // With a FormData body, fetch sets the multipart Content-Type (and its boundary) itself.
      res = await fetch(`${baseUrl}/api/v1${path}`, {
        method,
        ...(body ? { body } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // Connection refused (container stopped) or the timeout fired.
      const reason =
        error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'is not reachable';
      throw new ServiceUnavailableException(`Resume-Matcher at ${baseUrl} ${reason}`);
    }

    if (!res.ok) {
      throw new ResumeMatcherHttpError(path, res.status, await readDetail(res));
    }
    return (await res.json()) as T;
  }
}

/** FastAPI puts its error message in `detail`. Anything else is left out. */
async function readDetail(res: Response): Promise<string | null> {
  const json = (await res.json().catch(() => null)) as { detail?: unknown } | null;
  return typeof json?.detail === 'string' ? json.detail : null;
}
