import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphqlClient } from './client';
import {
  fetchJobCoverLetterPdf,
  fetchJobResumeBuildPdf,
  jobCoverLetterPdfUrl,
  fetchResumeBuild,
  fetchResumeBuildPdf,
  jobResumeBuildPdfUrl,
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

  it('builds a job copy’s PDF address and reads its PDF the same way', async () => {
    expect(jobResumeBuildPdfUrl('job 1')).toMatch(/\/resume-builder\/job\/job%201\/resume\.pdf$/);
    expect(jobResumeBuildPdfUrl('j1', true)).toMatch(/resume\.pdf\?download=1$/);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('%PDF', { headers: { 'X-Pdf-Pages': '1' } }));
    await expect(fetchJobResumeBuildPdf('j1')).resolves.toMatchObject({ pages: 1, styled: true });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/job/j1/resume.pdf'), {
      credentials: 'include',
    });
  });

  it('builds a job letter’s PDF address and reads its PDF', async () => {
    expect(jobCoverLetterPdfUrl('job 1')).toMatch(
      /\/resume-builder\/job\/job%201\/cover-letter\.pdf$/,
    );
    expect(jobCoverLetterPdfUrl('j1', true)).toMatch(/cover-letter\.pdf\?download=1$/);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('%PDF', { headers: { 'X-Pdf-Pages': '1' } }));
    await expect(fetchJobCoverLetterPdf('j1')).resolves.toMatchObject({ pages: 1 });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/job/j1/cover-letter.pdf'), {
      credentials: 'include',
    });
  });
});
