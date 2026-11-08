import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { apiError } from '../common/api-error';
import { DocumentsService } from '../documents/documents.service';
import type { DocumentFile } from '../documents/documents.service';
import { parseResume } from '../documents/resume-doc';
import { Prisma } from '../generated/prisma/client';
import { FitService } from '../insights/fit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RESUME_LANGUAGES } from '../profile/resumes';
import type { BuilderDoc } from './builder-doc';
import {
  BuilderDocError,
  fromResumeDoc,
  lockLanguages,
  readBuilderDoc,
  structurePrompt,
  textToBuilderDoc,
  toMarkdown,
} from './builder-doc';
import type { JobResumeBuildModel, ResumeBuildModel } from './resume-builder.model';

/** The builder's PDF, with what the preview shows next to it. */
export interface BuilderPdf extends DocumentFile {
  pages: number;
}

/** Whitespace differences (a trailing newline) don't make the resume "changed". */
const same = (a: string, b: string) => a.trim() === b.trim();

/**
 * The Resume builder: your master resume as sections. It reads the resume text from My profile
 * the first time, and every save writes the text back, so Fit %, prompts and the Apply kit keep
 * reading the same field they always have. Each user has their own rows.
 */
@Injectable()
export class ResumeBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fit: FitService,
    private readonly documents: DocumentsService,
  ) {}

  async get(userId: number, language?: string | null): Promise<ResumeBuildModel> {
    const me = await this.me(userId);
    const lang = this.pick(me, language);
    const master = this.masterText(me, lang);
    const row = await this.prisma.resumeBuild.findUnique({
      where: { userId_language: { userId, language: lang } },
    });
    if (row) return this.toModel(me, lang, row.doc, !same(row.syncedText, master), row.updatedAt);
    // First visit: read the resume on My profile into sections. Nothing is written to My profile
    // until you change something, so your uploaded text stays as it is.
    const doc = textToBuilderDoc(master, me.name);
    await this.prisma.resumeBuild.create({
      data: { userId, language: lang, doc: toJson(doc), syncedText: master },
    });
    return this.toModel(me, lang, doc, false, null);
  }

  /** Saves the builder's resume and writes it as text to My profile. */
  async save(userId: number, language: string, json: string): Promise<ResumeBuildModel> {
    const me = await this.me(userId);
    const lang = this.pick(me, language);
    const doc = lockLanguages(read(json), me.languages);
    const text = toMarkdown(doc);
    await this.writeMaster(userId, me, lang, text);
    const row = await this.prisma.resumeBuild.upsert({
      where: { userId_language: { userId, language: lang } },
      create: { userId, language: lang, doc: toJson(doc), syncedText: text },
      update: { doc: toJson(doc), syncedText: text },
    });
    // Your Fit % for every job starts again, as after any resume change.
    this.fit.warm(userId);
    return this.toModel(me, lang, doc, false, row.updatedAt);
  }

  /**
   * Starts the builder again: from the resume text on My profile (after a new upload), or from
   * an AI chat's reply to `prompt`, which puts the resume into the layout properly.
   */
  async restart(
    userId: number,
    language: string,
    reply?: string | null,
  ): Promise<ResumeBuildModel> {
    const me = await this.me(userId);
    const lang = this.pick(me, language);
    if (reply !== undefined && reply !== null) {
      if (!reply.trim()) {
        throw apiError(BadRequestException, 'RESUME_REPLY_EMPTY', 'Paste the AI chat reply first');
      }
      return this.save(userId, lang, JSON.stringify(fromResumeDoc(parseResume(reply, me.name))));
    }
    const master = this.masterText(me, lang);
    const doc = textToBuilderDoc(master, me.name);
    const row = await this.prisma.resumeBuild.upsert({
      where: { userId_language: { userId, language: lang } },
      create: { userId, language: lang, doc: toJson(doc), syncedText: master },
      update: { doc: toJson(doc), syncedText: master },
    });
    return this.toModel(me, lang, doc, false, row.updatedAt);
  }

  /** The AI chat prompt that reads your resume into the builder's layout. */
  async prompt(userId: number, language: string): Promise<string> {
    const me = await this.me(userId);
    const lang = this.pick(me, language);
    return structurePrompt(this.masterText(me, lang), lang);
  }

  /** The builder's resume as a PDF in your template (what you see is what you download). */
  async pdf(userId: number, language: string): Promise<BuilderPdf> {
    const { doc, language: lang } = await this.get(userId, language);
    const me = await this.me(userId);
    const text = toMarkdown(lockLanguages(read(doc), me.languages));
    const file = await this.documents.resumePdf(userId, text, lang);
    const pages = (await PDFDocument.load(file.bytes, { updateMetadata: false })).getPageCount();
    return { ...file, pages };
  }

  /**
   * Your resume for one job. A job you wrote a resume for in the Apply kit has one already; it is
   * read into sections the first time. Without one, `doc` is your master resume and `hasCopy` is
   * false until you start a copy.
   */
  async getJob(userId: number, jobId: string): Promise<JobResumeBuildModel> {
    const [me, job, row] = await Promise.all([
      this.me(userId),
      this.job(jobId),
      this.prisma.jobResume.findUnique({
        where: { userId_jobId: { userId, jobId } },
        select: { text: true, doc: true, updatedAt: true },
      }),
    ]);
    const language = this.pick(me, job.language);
    const master = await this.get(userId, language);
    const base = {
      jobId,
      title: job.title,
      company: job.company.name,
      language,
      masterDoc: master.doc,
      profileLanguages: me.languages,
      maxPages: me.maxPages,
    };
    if (!row) return { ...base, hasCopy: false, doc: master.doc, savedAt: null };
    // A resume from the Apply kit has only text: read it into sections (and keep it that way).
    const doc = row.doc
      ? lockLanguages(read(JSON.stringify(row.doc)), me.languages)
      : textToBuilderDoc(row.text, me.name);
    if (!row.doc) {
      await this.prisma.jobResume.update({
        where: { userId_jobId: { userId, jobId } },
        data: { doc: toJson(doc) },
        select: { userId: true },
      });
    }
    return { ...base, hasCopy: true, doc: JSON.stringify(doc), savedAt: row.updatedAt };
  }

  /** Starts this job's copy from your master resume. Starting again keeps the copy you have. */
  async startJob(userId: number, jobId: string): Promise<JobResumeBuildModel> {
    const current = await this.getJob(userId, jobId);
    if (!current.hasCopy) await this.writeJob(userId, jobId, current.doc);
    return this.getJob(userId, jobId);
  }

  /** Saves this job's resume. The text the Apply kit and the score read is written from it. */
  async saveJob(userId: number, jobId: string, json: string): Promise<JobResumeBuildModel> {
    const me = await this.me(userId);
    await this.job(jobId);
    await this.writeJob(userId, jobId, JSON.stringify(lockLanguages(read(json), me.languages)));
    return this.getJob(userId, jobId);
  }

  /** Throws this job's changes away: the copy becomes your master resume again. */
  async resetJob(userId: number, jobId: string): Promise<JobResumeBuildModel> {
    const current = await this.getJob(userId, jobId);
    await this.writeJob(userId, jobId, current.masterDoc);
    return this.getJob(userId, jobId);
  }

  /**
   * Puts one section of this job's copy into your master resume: it replaces the section with
   * the same id there, or is added at the end when the master has none. Everything else in the
   * master stays as it is.
   */
  async copySectionToMaster(
    userId: number,
    jobId: string,
    sectionId: string,
  ): Promise<JobResumeBuildModel> {
    const current = await this.getJob(userId, jobId);
    const copy = read(current.doc).sections.find((s) => s.id === sectionId);
    if (!current.hasCopy || !copy) {
      throw apiError(NotFoundException, 'SECTION_NOT_FOUND', 'That section is not in this resume');
    }
    const master = read(current.masterDoc);
    const at = master.sections.findIndex((s) => s.id === sectionId);
    const sections = [...master.sections];
    if (at >= 0) sections[at] = copy;
    else sections.push(copy);
    await this.save(userId, current.language, JSON.stringify({ ...master, sections }));
    return this.getJob(userId, jobId);
  }

  /** The job copy as a PDF in your template. */
  async jobPdf(userId: number, jobId: string): Promise<BuilderPdf> {
    const { doc, language, hasCopy } = await this.getJob(userId, jobId);
    if (!hasCopy) {
      throw apiError(
        NotFoundException,
        'JOB_RESUME_MISSING',
        'Start a resume copy for this job first',
      );
    }
    const me = await this.me(userId);
    const text = toMarkdown(lockLanguages(read(doc), me.languages));
    const file = await this.documents.resumePdf(userId, text, language);
    const pages = (await PDFDocument.load(file.bytes, { updateMetadata: false })).getPageCount();
    return { ...file, pages };
  }

  private async job(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { title: true, language: true, company: { select: { name: true } } },
    });
    if (!job) {
      throw apiError(NotFoundException, 'JOB_NOT_FOUND', `Job ${jobId} not found`, { id: jobId });
    }
    return job;
  }

  /** Writes the doc and its text to this job's resume row; a new text has not been AI-checked. */
  private async writeJob(userId: number, jobId: string, json: string) {
    const doc = read(json);
    const data = {
      text: toMarkdown(doc),
      doc: toJson(doc),
      aiStatus: null,
      aiScore: null,
      aiError: null,
      aiMissing: [],
      aiTips: [],
      aiStartedAt: null,
    };
    await this.prisma.jobResume.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId, ...data },
      update: data,
      select: { userId: true },
    });
  }

  private async me(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        profile: {
          select: {
            resumeText: true,
            resumeLanguage: true,
            languages: true,
            resumeMaxPages: true,
          },
        },
        languageResumes: { select: { language: true, text: true }, orderBy: { language: 'asc' } },
      },
    });
    const main = user.profile?.resumeLanguage ?? 'en';
    return {
      name: user.name,
      main,
      mainText: user.profile?.resumeText ?? '',
      others: new Map(
        user.languageResumes.filter((r) => r.language !== main).map((r) => [r.language, r.text]),
      ),
      languages: user.profile?.languages ?? [],
      maxPages: user.profile?.resumeMaxPages ?? 2,
    };
  }

  /** The language asked for, when you have a resume in it; your main language otherwise. */
  private pick(me: Me, language?: string | null): string {
    if (!language || language === me.main) return me.main;
    if (!(language in RESUME_LANGUAGES)) {
      throw apiError(BadRequestException, 'LANGUAGE_UNKNOWN', 'Pick a language from the list');
    }
    return me.others.has(language) ? language : me.main;
  }

  private masterText(me: Me, language: string): string {
    return language === me.main ? me.mainText : (me.others.get(language) ?? '');
  }

  private async writeMaster(userId: number, me: Me, language: string, text: string) {
    if (language === me.main) {
      await this.prisma.profile.upsert({
        where: { userId },
        create: { userId, resumeText: text },
        update: { resumeText: text },
        select: { userId: true },
      });
    } else {
      await this.prisma.languageResume.update({
        where: { userId_language: { userId, language } },
        data: { text },
        select: { userId: true },
      });
    }
  }

  private toModel(
    me: Me,
    language: string,
    doc: Prisma.JsonValue | BuilderDoc | string,
    outOfDate: boolean,
    savedAt: Date | null,
  ): ResumeBuildModel {
    // A doc saved by an older version is read the same way as one from the browser.
    const json = typeof doc === 'string' ? doc : JSON.stringify(doc);
    return {
      language,
      doc: JSON.stringify(lockLanguages(read(json), me.languages)),
      outOfDate,
      languages: [me.main, ...me.others.keys()],
      profileLanguages: me.languages,
      maxPages: me.maxPages,
      savedAt,
    };
  }
}

type Me = Awaited<ReturnType<ResumeBuilderService['me']>>;

const toJson = (doc: BuilderDoc) => doc as unknown as Prisma.InputJsonValue;

function read(json: string): BuilderDoc {
  try {
    return readBuilderDoc(json);
  } catch (error) {
    if (error instanceof BuilderDocError) {
      throw apiError(BadRequestException, 'RESUME_BUILD_INVALID', error.message);
    }
    throw error;
  }
}
