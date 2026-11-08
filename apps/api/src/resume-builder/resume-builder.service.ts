import { BadRequestException, Injectable } from '@nestjs/common';
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
import type { ResumeBuildModel } from './resume-builder.model';

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
