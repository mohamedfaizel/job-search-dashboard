import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const RENDERER = 'http://pdf-renderer.test';
const CREATE_JOB = `mutation ($input: CreateJobInput!) { createJob(input: $input) { id } }`;
const SAVE_TEXT = `mutation ($jobId: ID!, $text: String!) { saveJobResumeText(jobId: $jobId, text: $text) { jobId } }`;
const STYLE_FIELDS = 'resumeTemplate coverLetterLayout accentColor font showPhoto hasPhoto';
const STYLE = `query { documentStyle { ${STYLE_FIELDS} } }`;
const UPDATE = `mutation ($input: DocumentStyleInput!) { updateDocumentStyle(input: $input) { ${STYLE_FIELDS} } }`;
const TEMPLATES = `query { documentTemplates { resumeTemplates { id name } coverLetterLayouts { id } rendererConfigured rendererAvailable } }`;

const REPLY = `=== RESUME ===
# User Example
Frontend Engineer
Berlin | user@example.com

## Experience
### Frontend Engineer | Acme
Berlin | 01/2020 – today
- Built things.
=== COVER LETTER ===
Sehr geehrte Damen und Herren,

ich bewerbe mich mit großer Freude bei Ihnen, weil ich seit Jahren mit React arbeite und die Arbeit an Ihrer Plattform sehr spannend finde.

Mit freundlichen Grüßen
User Example
=== FORM ANSWERS ===
Why Acme: the product.`;

// Fake pdf-renderer: remembers each .tex it got and answers with a PDF stamped by "xdvipdfmx",
// like the real one, so the test can see the API cleans that off.
let rendered: { tex: string; files: string[] }[];
let renderFails = false;
const server = setupServer(
  http.get(`${RENDERER}/health`, () => HttpResponse.json({ ok: true })),
  http.post(`${RENDERER}/render`, async ({ request: req }) => {
    const body = (await req.json()) as { tex: string; files: Record<string, string> };
    rendered.push({ tex: body.tex, files: Object.keys(body.files) });
    if (renderFails) return HttpResponse.json({ message: 'LaTeX failed' }, { status: 422 });
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.setCreator('LaTeX with hyperref');
    doc.setProducer('xdvipdfmx (20240305)');
    return new HttpResponse(await doc.save(), { headers: { 'Content-Type': 'application/pdf' } });
  }),
);

/** 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const binary = (req: request.Test) =>
  req.buffer(true).parse((r, done) => {
    const chunks: Buffer[] = [];
    r.on('data', (c: Buffer) => chunks.push(c));
    r.on('end', () => {
      done(null, Buffer.concat(chunks));
    });
  });

describe('resume and cover letter templates', () => {
  let t: TestApp;
  let jobId: string;

  beforeAll(async () => {
    server.listen({ onUnhandledFrame: 'bypass' });
    t = await createTestApp({ PDF_RENDERER_URL: RENDERER });
  });
  afterAll(async () => {
    server.close();
    await t.app.close();
  });
  beforeEach(async () => {
    rendered = [];
    renderFails = false;
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    const job = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
      input: {
        title: 'Frontend Entwickler',
        companyName: 'Acme GmbH',
        city: 'Hamburg',
        description: 'Wir suchen einen Frontend Entwickler.',
      },
    });
    jobId = job.data!.createJob.id;
    const saved = await t.asUser(SAVE_TEXT, { jobId, text: REPLY });
    expect(saved.errors).toBeUndefined();
  });

  const pdf = (path: string, role: 'USER' | 'ADMIN' = 'USER') =>
    binary(request(t.server).get(path).set('Cookie', t.cookieFor(role)));

  it('starts with the defaults, saves your choices and keeps them to you', async () => {
    const start = await t.asUser<{ documentStyle: Record<string, unknown> }>(STYLE);
    expect(start.data!.documentStyle).toEqual({
      resumeTemplate: 'classic',
      coverLetterLayout: 'auto',
      accentColor: '1F4E79',
      font: 'auto',
      showPhoto: false,
      hasPhoto: false,
    });
    const input = {
      resumeTemplate: 'modern',
      coverLetterLayout: 'din',
      accentColor: '#0e7c66',
      font: 'serif',
      showPhoto: false,
    };
    const saved = await t.asUser<{ updateDocumentStyle: Record<string, unknown> }>(UPDATE, {
      input,
    });
    expect(saved.data!.updateDocumentStyle).toMatchObject({
      resumeTemplate: 'modern',
      accentColor: '0E7C66',
    });
    const admin = await t.gql<{ documentStyle: { resumeTemplate: string } }>(STYLE);
    expect(admin.data!.documentStyle.resumeTemplate).toBe('classic');

    const bad = await t.asUser(UPDATE, { input: { ...input, accentColor: 'red' } });
    expect(bad.errors?.[0]?.message).toContain('six hex digits');
    const badTemplate = await t.asUser(UPDATE, { input: { ...input, resumeTemplate: 'x' } });
    expect(badTemplate.errors?.[0]?.message).toContain('Pick a resume template');
  });

  it('lists the templates and says the renderer is running', async () => {
    const res = await t.asUser<{
      documentTemplates: { resumeTemplates: { id: string }[]; rendererAvailable: boolean };
    }>(TEMPLATES);
    expect(res.data!.documentTemplates.resumeTemplates.map((r) => r.id)).toEqual([
      'classic',
      'modern',
      'compact',
    ]);
    expect(res.data!.documentTemplates.rendererAvailable).toBe(true);
  });

  it('typesets the resume in your template, with clean PDF properties', async () => {
    await t.asUser(UPDATE, {
      input: {
        resumeTemplate: 'modern',
        coverLetterLayout: 'auto',
        accentColor: '#0e7c66',
        font: 'auto',
        showPhoto: false,
      },
    });
    const res = await pdf(`/job-resume/${jobId}/resume.pdf`).expect(200);
    expect(res.headers['content-disposition']).toContain('User-Resume-Acme.pdf');
    expect(rendered[0]?.tex).toContain('\\definecolor{accent}{HTML}{0E7C66}');
    expect(rendered[0]?.tex).toContain(
      '\\textbf{Frontend Engineer} {\\color{muted}\\textbar} Acme',
    );

    const doc = await PDFDocument.load(res.body as Buffer, { updateMetadata: false });
    expect(doc.getTitle()).toBe('User – Resume');
    expect(doc.getAuthor()).toBe('User');
    expect(doc.getCreator()).toBeUndefined();
    expect(doc.getProducer()).toBeUndefined();

    // Another template for this download only.
    await pdf(`/job-resume/${jobId}/resume.pdf?template=compact`).expect(200);
    expect(rendered[1]?.tex).toContain('{\\color{accent}\\bfseries Experience}');
    // Not yours: no file.
    await pdf(`/job-resume/${jobId}/resume.pdf`, 'ADMIN').expect(404);
  });

  it('writes a German cover letter as a DIN 5008 letter', async () => {
    await t.prisma.profile.create({
      data: { userId: 2, address: 'Hauptstraße 1, 52062 Aachen', phone: '+49 151 0000000' },
    });
    const res = await pdf(`/job-resume/${jobId}/cover-letter.pdf`).expect(200);
    expect(res.headers['content-disposition']).toContain('User-Anschreiben-Acme.pdf');
    const tex = rendered[0]?.tex ?? '';
    expect(tex).toContain('\\begin{textblock}{85}(25,48)');
    expect(tex).toContain('Acme GmbH\\\\\nHamburg');
    expect(tex).toContain('\\textbf{Bewerbung als Frontend Entwickler}');
    expect(tex).toMatch(/Aachen, \d\d\.\d\d\.\d{4}/);
    const doc = await PDFDocument.load(res.body as Buffer, { updateMetadata: false });
    expect(doc.getTitle()).toBe('User – Anschreiben');
  });

  it('adds your photo when you switch it on, and removes it again', async () => {
    const upload = await request(t.server)
      .post('/documents/photo')
      .set('Cookie', t.cookieFor('USER'))
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' })
      .expect(201);
    expect(upload.body).toMatchObject({ hasPhoto: true, showPhoto: true });
    const photo = await pdf('/documents/photo').expect(200);
    expect(photo.headers['content-type']).toBe('image/png');

    await pdf(`/job-resume/${jobId}/resume.pdf`).expect(200);
    expect(rendered[0]?.files).toEqual(['photo.png']);
    expect(rendered[0]?.tex).toContain('{photo.png}');

    const gif = await request(t.server)
      .post('/documents/photo')
      .set('Cookie', t.cookieFor('USER'))
      .attach('file', Buffer.from('GIF89a'), { filename: 'me.gif', contentType: 'image/gif' });
    expect(gif.status).toBe(400);

    await request(t.server)
      .delete('/documents/photo')
      .set('Cookie', t.cookieFor('USER'))
      .expect(200);
    await pdf('/documents/photo').expect(404);
  });

  it('sends the plain PDF when LaTeX fails, so the download still works', async () => {
    renderFails = true;
    const res = await pdf(`/job-resume/${jobId}/resume.pdf`).expect(200);
    expect(rendered).toHaveLength(1);
    const doc = await PDFDocument.load(res.body as Buffer, { updateMetadata: false });
    expect(doc.getTitle()).toBe('User – Resume');
    expect(doc.getProducer()).toBeUndefined();
  });

  it('shows a sample in any template, to compare them', async () => {
    const res = await pdf('/documents/preview/resume.pdf?template=compact&accent=AA3300').expect(
      200,
    );
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
    expect(rendered[0]?.tex).toContain('\\definecolor{accent}{HTML}{AA3300}');
    expect(rendered[0]?.tex).toContain('User');
    await pdf('/documents/preview/cover-letter.pdf?layout=din').expect(200);
    expect(rendered[1]?.tex).toContain('textblock');
  });
});
