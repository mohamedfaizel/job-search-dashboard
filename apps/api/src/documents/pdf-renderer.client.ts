import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const HEALTH_TIMEOUT_MS = 3_000;
/** XeLaTeX takes a second or two; the first run after start can take longer. */
const RENDER_TIMEOUT_MS = 60_000;

/** LaTeX could not make the PDF: `log` is the end of its log, for the server log. */
export class RenderError extends Error {
  constructor(readonly log: string) {
    super('The PDF renderer could not make this PDF');
  }
}

/**
 * Talks to the pdf-renderer container (docker/pdf-renderer): sends a .tex file and any images,
 * gets a PDF back; or sends
 * a Word file and gets it back as a PDF. Set PDF_RENDERER_URL in .env; empty switches templates off.
 */
@Injectable()
export class PdfRendererClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('PDF_RENDERER_URL') ?? '').replace(/\/+$/, '');
  }

  get isConfigured(): boolean {
    return this.baseUrl !== '';
  }

  /** True when the container answers. Never throws. */
  async isReachable(): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Renders a .tex file. `files` are images next to it, e.g. { "photo.jpg": bytes }. */
  async render(tex: string, files: Record<string, Buffer> = {}): Promise<Uint8Array> {
    const res = await fetch(`${this.baseUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tex,
        files: Object.fromEntries(
          Object.entries(files).map(([name, bytes]) => [name, bytes.toString('base64')]),
        ),
      }),
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new RenderError(body?.message ?? `HTTP ${String(res.status)}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  /** Turns a Word (.docx) file into a PDF, with LibreOffice in the same container. */
  async convert(docx: Buffer): Promise<Uint8Array> {
    const res = await fetch(`${this.baseUrl}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': DOCX_TYPE },
      body: new Uint8Array(docx),
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new RenderError(body?.message ?? `HTTP ${String(res.status)}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
}
