import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphqlClient } from './client';
import {
  fetchResumeBuild,
  fetchResumeBuildPdf,
  fetchResumeBuildPrompt,
  restartResumeBuild,
  resumeBuildPdfUrl,
  saveResumeBuild,
} from './resumeBuilder';

const BUILD = {
  language: 'en',
  doc: '{"sections":[]}',
  outOfDate: false,
  languages: ['en'],
  profileLanguages: [],
  maxPages: 2,
  savedAt: null,
};

describe('Resume builder API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads, saves and reads again through GraphQL', async () => {
    const request = vi.spyOn(graphqlClient, 'request');
    request.mockResolvedValueOnce({ resumeBuild: BUILD });
    await expect(fetchResumeBuild(null)).resolves.toEqual(BUILD);
    expect(request).toHaveBeenLastCalledWith(expect.stringContaining('query ResumeBuild'), {
      language: null,
    });

    request.mockResolvedValueOnce({ saveResumeBuild: BUILD });
    await expect(saveResumeBuild({ language: 'en', doc: '{}' })).resolves.toEqual(BUILD);

    request.mockResolvedValueOnce({ restartResumeBuild: BUILD });
    await expect(restartResumeBuild({ language: 'en', reply: '# Ada' })).resolves.toEqual(BUILD);

    request.mockResolvedValueOnce({ resumeBuildPrompt: 'Prompt' });
    await expect(fetchResumeBuildPrompt('de')).resolves.toBe('Prompt');
  });

  it('builds the PDF address, with ?download=1 to save it', () => {
    expect(resumeBuildPdfUrl('de')).toMatch(/\/resume-builder\/de\/resume\.pdf$/);
    expect(resumeBuildPdfUrl('en', true)).toMatch(/resume\.pdf\?download=1$/);
  });

  it('reads the page count and template flag from the PDF response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('%PDF', { headers: { 'X-Pdf-Pages': '2', 'X-Pdf-Styled': '0' } }),
    );
    const pdf = await fetchResumeBuildPdf('en');
    expect(pdf).toMatchObject({ pages: 2, styled: false });
  });

  it('turns a failed PDF into an error with the API code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ message: 'No', code: 'LANGUAGE_UNKNOWN' }, { status: 400 }),
    );
    await expect(fetchResumeBuildPdf('xx')).rejects.toMatchObject({ code: 'LANGUAGE_UNKNOWN' });
  });
});
