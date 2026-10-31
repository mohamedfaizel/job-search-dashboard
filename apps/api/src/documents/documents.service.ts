import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { germanRequirement } from '../insights/german';
import { pdfFileName, textToPdf } from '../insights/pdf';
import { detectLanguage } from '../insights/text';
import { PrismaService } from '../prisma/prisma.service';
import type {
  DocumentStyleInput,
  DocumentStyleModel,
  DocumentTemplatesModel,
  WordTemplateModel,
} from './documents.model';
import { analyseDocx, DocxTemplateError, fillDocx } from './docx-template';
import { cleanPdf } from './pdf-metadata';
import { DOCX_TYPE, PdfRendererClient, RenderError } from './pdf-renderer.client';
import type { ResumeDoc } from './resume-doc';
import { letterParagraphs, parseResume } from './resume-doc';
import type {
  DocumentLook,
  FontChoice,
  LetterLayoutId,
  ResumeChoice,
  ResumeTemplateId,
} from './templates';
import {
  coverLetterTex,
  hexColor,
  isLetterLayout,
  isResumeChoice,
  LETTER_LAYOUTS,
  MY_WORD_FILE,
  RESUME_TEMPLATES,
  resumeTex,
} from './templates';

/** A file to download. */
export interface DocumentFile {
  name: string;
  type: string;
  bytes: Buffer;
}

export type DocumentKind = 'resume' | 'cover-letter';

/** Your master resume as a Word file, to use as the template. */
interface WordFile {
  language: string;
  fileName: string;
  bytes: Buffer;
  /** The text of that resume and your profile headline, to find the headline in the file. */
  text: string;
  headline: string;
}

const isDocx = (fileName: string | null, type: string | null) =>
  type === DOCX_TYPE || /\.docx$/i.test(fileName ?? '');

/** What the PDF looks like before anything is saved. */
const DEFAULT_STYLE = {
  resumeTemplate: 'classic',
  coverLetterLayout: 'auto',
  accentColor: '1F4E79',
  font: 'auto',
  showPhoto: false,
} as const;

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES: Record<string, 'jpg' | 'png'> = { 'image/jpeg': 'jpg', 'image/png': 'png' };

/** Last part of an address without the postcode: "Hauptstraße 1, 52062 Aachen" → "Aachen". */
export function cityOf(address: string): string | null {
  const parts = address
    .split(/[,\n]/)
    .map((p) => p.replace(/\b\d{4,5}\b/g, '').trim())
    .filter(Boolean)
    .filter((p) => !/^(germany|deutschland|österreich|austria|schweiz|switzerland)$/i.test(p));
  return parts[parts.length - 1] ?? null;
}

/** A short resume for the template preview, with your name in it. */
const sampleResume = (name: string) => `# ${name}
Senior Frontend Engineer
Berlin, Germany | +49 151 0000000 | you@example.com | linkedin.com/in/you

## Summary
Frontend engineer with eight years of React and TypeScript, building design systems and data-heavy dashboards that thousands of people use every day.

## Skills
- **Frontend:** React, TypeScript, Next.js, Tailwind CSS, Figma
- **Testing:** Vitest, Playwright, Storybook
- **Ways of working:** Kanban, Scrum, code review

## Experience
### Senior Frontend Engineer | Example GmbH
Berlin | 01/2021 – today
- Built a micro-frontend dashboard with Module Federation, used by 40 teams.
- Cut page load time by 35% with code splitting and caching.

### Frontend Developer | Sample AG
Hamburg | 03/2017 – 12/2020
- Shipped a design system in React used across five products.

## Education
### B.Sc. Computer Science | Example University
2012 – 2016

## Languages
- English: C1
- German: A2
`;

const SAMPLE_LETTER = `Dear hiring team,

I am applying for the Senior Frontend Engineer role. For eight years I have built React and TypeScript products, most recently a dashboard used by 40 teams.

I would bring the same care for performance and accessibility to your team.

I look forward to hearing from you.

Kind regards`;

/**
 * Turns the resume and cover letter you saved for a job into PDFs in your template. LaTeX does
 * the typesetting (in the pdf-renderer container); when that isn't running, the plain PDF is
 * sent instead, so downloads always work. Either way the PDF properties name only you.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: PdfRendererClient,
  ) {}

  async style(userId: number): Promise<DocumentStyleModel> {
    const row = await this.prisma.documentStyle.findUnique({
      where: { userId },
      omit: { photo: true },
    });
    return {
      resumeTemplate: row?.resumeTemplate ?? DEFAULT_STYLE.resumeTemplate,
      coverLetterLayout: row?.coverLetterLayout ?? DEFAULT_STYLE.coverLetterLayout,
      accentColor: row?.accentColor ?? DEFAULT_STYLE.accentColor,
      font: row?.font ?? DEFAULT_STYLE.font,
      showPhoto: row?.showPhoto ?? DEFAULT_STYLE.showPhoto,
      hasPhoto: !!row?.photoType,
    };
  }

  async updateStyle(userId: number, input: DocumentStyleInput): Promise<DocumentStyleModel> {
    const data = {
      resumeTemplate: input.resumeTemplate,
      coverLetterLayout: input.coverLetterLayout,
      accentColor: hexColor(input.accentColor),
      font: input.font,
      showPhoto: input.showPhoto,
    };
    await this.prisma.documentStyle.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.style(userId);
  }

  async templates(userId: number): Promise<DocumentTemplatesModel> {
    const [rendererAvailable, wordTemplate] = await Promise.all([
      this.renderer.isReachable(),
      this.wordTemplate(userId),
    ]);
    return {
      resumeTemplates: [
        ...RESUME_TEMPLATES.map((t) => ({ ...t })),
        ...(wordTemplate?.usable ? [{ ...MY_WORD_FILE }] : []),
      ],
      coverLetterLayouts: LETTER_LAYOUTS.map((l) => ({ ...l })),
      wordTemplate,
      rendererConfigured: this.renderer.isConfigured,
      rendererAvailable,
    };
  }

  /** What in your Word master resume can be used as a template; null without one. */
  async wordTemplate(userId: number): Promise<WordTemplateModel | null> {
    const file = await this.wordFile(userId, null);
    if (!file) return null;
    return { language: file.language, fileName: file.fileName, ...(await analyseDocx(file.bytes)) };
  }

  /**
   * Your Word master resume for a language: the one in that language, else your main resume,
   * else any. The layout carries over to every language; the words come from Claude.
   */
  private async wordFile(userId: number, language: string | null): Promise<WordFile | null> {
    const [profile, others] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: {
          headline: true,
          resumeText: true,
          resumeLanguage: true,
          resumeFileName: true,
          resumeFileType: true,
          resumeFile: true,
        },
      }),
      this.prisma.languageResume.findMany({
        where: { userId, file: { not: null } },
        select: { language: true, text: true, fileName: true, fileType: true, file: true },
        orderBy: { language: 'asc' },
      }),
    ]);
    const files: WordFile[] = [];
    if (profile?.resumeFile && isDocx(profile.resumeFileName, profile.resumeFileType)) {
      files.push({
        language: profile.resumeLanguage,
        fileName: profile.resumeFileName ?? 'resume.docx',
        bytes: Buffer.from(profile.resumeFile),
        text: profile.resumeText,
        headline: profile.headline,
      });
    }
    for (const r of others) {
      if (r.file && isDocx(r.fileName, r.fileType)) {
        files.push({
          language: r.language,
          fileName: r.fileName ?? 'resume.docx',
          bytes: Buffer.from(r.file),
          text: r.text,
          headline: profile?.headline ?? '',
        });
      }
    }
    return files.find((f) => f.language === language) ?? files[0] ?? null;
  }

  /** The tailored resume in your own Word file. */
  private async fillWordFile(
    userId: number,
    resume: ResumeDoc,
    props: { title: string; author: string; language: string },
  ): Promise<Buffer> {
    const file = await this.wordFile(userId, props.language);
    if (!file) {
      throw new BadRequestException(
        'Upload your master resume as a Word (.docx) file on “My profile” to use it as the template',
      );
    }
    try {
      return await fillDocx(file.bytes, resume, {
        ...props,
        knownHeadlines: [file.headline, parseResume(file.text, '').headline ?? ''],
      });
    } catch (error) {
      if (error instanceof DocxTemplateError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  /** The tailored resume for a job as an editable Word file, in your own Word layout. */
  async jobDocx(userId: number, jobId: string): Promise<DocumentFile> {
    const { text, language, company, me } = await this.jobText(userId, jobId, 'resume');
    const name = me.name.trim() || 'Resume';
    const label = language === 'de' ? 'Lebenslauf' : 'Resume';
    const resume = parseResume(text, name);
    if (!resume.contact.length) resume.contact = me.contact;
    return {
      name: pdfFileName(me.name, label, company).replace(/\.pdf$/, '.docx'),
      type: DOCX_TYPE,
      bytes: await this.fillWordFile(userId, resume, {
        title: `${name} – ${label}`,
        author: name,
        language,
      }),
    };
  }

  async savePhoto(userId: number, type: string, bytes: Buffer): Promise<DocumentStyleModel> {
    if (!PHOTO_TYPES[type]) throw new BadRequestException('Upload a JPEG or PNG photo');
    if (bytes.length > MAX_PHOTO_BYTES) throw new BadRequestException('The photo is over 2 MB');
    const data = { photo: new Uint8Array(bytes), photoType: type };
    await this.prisma.documentStyle.upsert({
      where: { userId },
      // A new photo is shown, unless you switch it off again.
      create: { userId, ...data, showPhoto: true },
      update: data,
    });
    return this.style(userId);
  }

  async deletePhoto(userId: number): Promise<DocumentStyleModel> {
    await this.prisma.documentStyle.updateMany({
      where: { userId },
      data: { photo: null, photoType: null, showPhoto: false },
    });
    return this.style(userId);
  }

  async photo(userId: number): Promise<DocumentFile> {
    const row = await this.prisma.documentStyle.findUnique({
      where: { userId },
      select: { photo: true, photoType: true },
    });
    if (!row?.photo || !row.photoType) throw new NotFoundException('No photo uploaded');
    return {
      name: `photo.${PHOTO_TYPES[row.photoType] ?? 'jpg'}`,
      type: row.photoType,
      bytes: Buffer.from(row.photo),
    };
  }

  /**
   * The resume or cover letter saved for a job as a PDF. `template` picks another resume
   * template for this download only.
   */
  async jobPdf(
    userId: number,
    jobId: string,
    kind: DocumentKind,
    template?: string,
  ): Promise<DocumentFile> {
    const { text, language, company, me, job } = await this.jobText(userId, jobId, kind);
    return this.makePdf(userId, me, {
      kind,
      text,
      language,
      template,
      company,
      companyCity: job.city,
      jobTitle: job.title,
    });
  }

  /** The resume or cover letter saved for a job, and the language it is written in. */
  private async jobText(userId: number, jobId: string, kind: DocumentKind) {
    const [row, me, job] = await Promise.all([
      this.prisma.jobResume.findUnique({
        where: { userId_jobId: { userId, jobId } },
        select: { text: true, coverLetter: true },
      }),
      this.me(userId),
      this.prisma.job.findUnique({
        where: { id: jobId },
        select: {
          title: true,
          city: true,
          description: true,
          language: true,
          company: { select: { name: true } },
        },
      }),
    ]);
    const text = kind === 'resume' ? row?.text : row?.coverLetter;
    if (!text?.trim() || !job) {
      throw new NotFoundException(
        kind === 'resume' ? 'No resume saved for this job' : 'No cover letter saved for this job',
      );
    }
    // The language it is written in; a text too short to tell is in the job's resume language.
    const jobLanguage = job.language ?? detectLanguage(job.description);
    const language =
      detectLanguage(text) ??
      (germanRequirement(job.description, jobLanguage).required ? 'de' : 'en');
    return { text, language, company: job.company.name, me, job };
  }

  /** A sample resume or cover letter in a template, with your name, to compare templates. */
  async preview(
    userId: number,
    kind: DocumentKind,
    overrides: { template?: string; accent?: string; font?: string; layout?: string },
  ): Promise<DocumentFile> {
    const me = await this.me(userId);
    const name = me.name || 'Your Name';
    return this.makePdf(userId, me, {
      kind,
      text: kind === 'resume' ? sampleResume(name) : `${SAMPLE_LETTER}\n${name}`,
      language: overrides.layout === 'din' ? 'de' : 'en',
      template: overrides.template,
      accent: overrides.accent,
      font: overrides.font,
      layout: overrides.layout,
      company: 'Example GmbH',
      companyCity: 'Berlin',
      jobTitle: 'Senior Frontend Engineer',
      preview: true,
    });
  }

  /** Your name and the contact details a resume header and a letter need. */
  private async me(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        profile: {
          select: {
            phone: true,
            address: true,
            linkedinUrl: true,
            githubUrl: true,
            websiteUrl: true,
          },
        },
      },
    });
    const p = user.profile;
    return {
      name: user.name,
      address: p?.address ?? '',
      contact: [p?.address, p?.phone, user.email, p?.linkedinUrl, p?.githubUrl, p?.websiteUrl]
        .map((c) => (c ?? '').trim())
        .filter(Boolean),
    };
  }

  private async makePdf(
    userId: number,
    me: { name: string; address: string; contact: string[] },
    doc: {
      kind: DocumentKind;
      text: string;
      language: string;
      template?: string | undefined;
      accent?: string | undefined;
      font?: string | undefined;
      layout?: string | undefined;
      company: string;
      companyCity: string | null;
      jobTitle: string;
      preview?: boolean;
    },
  ): Promise<DocumentFile> {
    const german = doc.language === 'de';
    const label =
      doc.kind === 'resume'
        ? german
          ? 'Lebenslauf'
          : 'Resume'
        : german
          ? 'Anschreiben'
          : 'Cover letter';
    const name = me.name.trim() || 'Resume';
    const fileName = pdfFileName(
      me.name,
      label.replace(/\s+/g, '-'),
      doc.preview ? (doc.template ?? 'Preview') : doc.company,
    );
    const props = { title: `${name} – ${label}`, author: name, language: doc.language };

    const style = await this.prisma.documentStyle.findUnique({ where: { userId } });
    const choice = (
      doc.template && isResumeChoice(doc.template)
        ? doc.template
        : (style?.resumeTemplate ?? DEFAULT_STYLE.resumeTemplate)
    ) as ResumeChoice;
    // Your Word file sets the resume's look; the cover letter then uses Classic.
    const template: ResumeTemplateId = choice === MY_WORD_FILE.id ? 'classic' : choice;
    const photoType = style?.showPhoto && style.photoType ? PHOTO_TYPES[style.photoType] : null;
    const look: DocumentLook = {
      template,
      accent: hexColor(doc.accent ?? style?.accentColor ?? DEFAULT_STYLE.accentColor),
      font: (doc.font && ['auto', 'sans', 'serif'].includes(doc.font)
        ? doc.font
        : (style?.font ?? 'auto')) as FontChoice,
      photo: photoType ? `photo.${photoType}` : null,
      language: doc.language,
    };

    let pdf: Uint8Array | null = null;
    if (await this.renderer.isReachable()) {
      try {
        if (doc.kind === 'resume') {
          const resume = parseResume(doc.text, name);
          if (!resume.contact.length) resume.contact = me.contact;
          if (choice === MY_WORD_FILE.id) {
            try {
              pdf = await this.renderer.convert(await this.fillWordFile(userId, resume, props));
            } catch (error) {
              // No usable Word file (any more), or LibreOffice failed: Classic instead.
              this.logger.warn(`Word template failed, using Classic: ${String(error)}`);
            }
          }
          const files: Record<string, Buffer> =
            look.photo && style?.photo ? { [look.photo]: Buffer.from(style.photo) } : {};
          pdf ??= await this.renderer.render(resumeTex(resume, look), files);
        } else {
          const chosen = (
            doc.layout && isLetterLayout(doc.layout)
              ? doc.layout
              : (style?.coverLetterLayout ?? 'auto')
          ) as LetterLayoutId;
          const layout = chosen === 'auto' ? (german ? 'din' : 'modern') : chosen;
          const tex = coverLetterTex(
            {
              name,
              contact: me.contact.slice(0, 3),
              city: cityOf(me.address),
              company: doc.company,
              companyCity: doc.companyCity,
              jobTitle: doc.jobTitle,
              paragraphs: letterParagraphs(doc.text),
              date: new Date(),
            },
            look,
            layout,
          );
          pdf = await this.renderer.render(tex);
        }
      } catch (error) {
        // A reply LaTeX can't typeset still downloads, as the plain PDF.
        const detail = error instanceof RenderError ? error.log : String(error);
        this.logger.warn(`Template PDF failed, sending the plain one: ${detail.slice(-400)}`);
      }
    }
    pdf ??= await textToPdf(doc.text, props.title);
    return {
      name: fileName,
      type: 'application/pdf',
      bytes: Buffer.from(await cleanPdf(pdf, props)),
    };
  }
}
