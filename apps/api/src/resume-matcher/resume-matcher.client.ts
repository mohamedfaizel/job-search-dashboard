import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  RmHealthResponse,
  RmImprovePreviewResponse,
  RmJobUploadResponse,
  RmLlmConfigResponse,
  RmResumeUploadResponse,
  RmStatusResponse,
} from './resume-matcher.types';

/** The health check is instant; the status check waits for one small AI call. */
const HEALTH_TIMEOUT_MS = 5_000;
const STATUS_TIMEOUT_MS = 30_000;
/** An upload waits while Resume-Matcher's AI reads the resume into sections. */
const UPLOAD_TIMEOUT_MS = 180_000;
const DELETE_TIMEOUT_MS = 15_000;
const JOB_UPLOAD_TIMEOUT_MS = 15_000;
/** Resume-Matcher gives up on its own after 240 s, so wait a little longer than that. */
const PREVIEW_TIMEOUT_MS = 270_000;

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

  /** The provider and model it really uses: ones saved in its own Settings page beat .env. */
  llmConfig(): Promise<RmLlmConfigResponse> {
    return this.request<RmLlmConfigResponse>('GET', '/config/llm-api-key', HEALTH_TIMEOUT_MS);
  }

  /** Stores a job description (no AI yet) and returns Resume-Matcher's id for it. */
  async uploadJob(description: string, resumeId: string): Promise<string> {
    const res = await this.request<RmJobUploadResponse>(
      'POST',
      '/jobs/upload',
      JOB_UPLOAD_TIMEOUT_MS,
      { job_descriptions: [description], resume_id: resumeId },
    );
    const jobId = res.job_id[0];
    if (!jobId) throw new ServiceUnavailableException('Resume-Matcher returned no job id');
    return jobId;
  }

  /**
   * Tailors the resume to the job without saving it, and scores the result. Several AI calls,
   * so it takes a minute or two. The "nudge" prompt asks for minimal edits: the score stays
   * close to your resume as it is, and fewer rewrites mean fewer tokens.
   */
  improvePreview(resumeId: string, jobId: string): Promise<RmImprovePreviewResponse> {
    return this.request<RmImprovePreviewResponse>(
      'POST',
      '/resumes/improve/preview',
      PREVIEW_TIMEOUT_MS,
      { resume_id: resumeId, job_id: jobId, prompt_id: 'nudge' },
    );
  }

  private get baseUrl(): string | null {
    const url = this.config.get<string>('RESUME_MATCHER_URL')?.trim();
    return url ? url.replace(/\/+$/, '') : null;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    timeoutMs: number,
    body?: FormData | Record<string, unknown>,
  ): Promise<T> {
    const baseUrl = this.baseUrl;
    if (!baseUrl) {
      throw new ServiceUnavailableException('RESUME_MATCHER_URL is not set in .env');
    }

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/v1${path}`, {
        method,
        ...encodeBody(body),
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

/** A Resume-Matcher failure as one sentence for the user, saying what to do next. */
export function describeError(error: unknown): string {
  if (error instanceof ResumeMatcherHttpError) return error.detail ?? error.message;
  const text = error instanceof Error ? error.message : String(error);
  return text.includes('not reachable') ? `${text}. Start it with pnpm rm:up.` : text;
}

/** With a FormData body, fetch sets the multipart Content-Type (and its boundary) itself. */
function encodeBody(body: FormData | Record<string, unknown> | undefined): RequestInit {
  if (!body) return {};
  if (body instanceof FormData) return { body };
  return { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } };
}

/** FastAPI puts its error message in `detail`. Anything else is left out. */
async function readDetail(res: Response): Promise<string | null> {
  const json = (await res.json().catch(() => null)) as { detail?: unknown } | null;
  return typeof json?.detail === 'string' ? json.detail : null;
}
