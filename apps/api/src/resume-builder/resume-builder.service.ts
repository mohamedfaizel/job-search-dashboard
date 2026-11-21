import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { AI_PROVIDERS, AiCallError, completeWithKey } from '../api-keys/ai-providers';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { apiError } from '../common/api-error';
import { DocumentsService } from '../documents/documents.service';
import type { DocumentFile } from '../documents/documents.service';
import { letterParagraphs, parseResume } from '../documents/resume-doc';
import { Prisma } from '../generated/prisma/client';
import { factCheck } from '../insights/fact-check';
import { FitService } from '../insights/fit.service';
import { InsightsService } from '../insights/insights.service';
import { achievementLines } from '../insights/prompt';
import { mentions } from '../insights/skills';
import { listedFor } from '../jobs/listed-for';
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
import { buildImprovePrompt, readSuggestion, sectionMarkdown } from './improve-section';
import { buildLetterPrompt, readLetter } from './letter';
import type {
  ImproveLetterInput,
  ImproveSectionInput,
  CoverLetterTemplateModel,
  JobCoverLetterModel,
  JobResumeBuildModel,
  JobResumeCopyModel,
  LetterSuggestionModel,
  ResumeBuildModel,
  SectionSuggestionModel,
} from './resume-builder.model';

/** The builder's PDF, with what the preview shows next to it. */
export interface BuilderPdf extends DocumentFile {
  pages: number;
}

/** The switcher lists this many job copies; older ones open from their job. */
const JOB_COPIES_LISTED = 30;

/** A cover letter is a page; this is far more than any real one needs. */
const MAX_LETTER_CHARS = 20_000;

/** Whitespace differences (a trailing newline) don't make the resume "changed". */
/** A letter (or template) longer than MAX_LETTER_CHARS is refused. */
function tooLongLetter(text: string): void {
  if (text.length > MAX_LETTER_CHARS) {
    throw apiError(
      BadRequestException,
      'REPLY_PART_TOO_LONG',
      `A cover letter is at most ${String(MAX_LETTER_CHARS)} characters`,
      { max: MAX_LETTER_CHARS },
    );
  }
}

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
    private readonly insights: InsightsService,
    private readonly apiKeys: ApiKeysService,
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

  /** The AI chat prompt that improves one section of this resume (master or a job's copy). */
  async improvePrompt(userId: number, input: ImproveSectionInput): Promise<string> {
    return (await this.improveContext(userId, input)).prompt;
  }

  /**
   * Improves one section: from the AI chat reply you pasted, or, without one, by asking your own
   * saved AI key. Nothing is changed here: the suggestion comes back with its fact check, and
   * you keep or discard it on screen.
   */
  async improve(userId: number, input: ImproveSectionInput): Promise<SectionSuggestionModel> {
    const ctx = await this.improveContext(userId, input);
    const reply = input.reply?.trim()
      ? input.reply.slice(0, 60_000)
      : await this.askOwnKey(userId, ctx.prompt);
    const section = readSuggestion(reply, ctx.section);
    if (!section) {
      throw apiError(BadRequestException, 'SUGGESTION_UNREADABLE', 'The reply has no resume text');
    }
    const after = sectionMarkdown(section);
    return {
      sectionId: ctx.section.id,
      before: ctx.before,
      after,
      section: JSON.stringify(section),
      findings: factCheck({
        resume: after,
        coverLetter: '',
        sources: ctx.sources,
        jobSkills: ctx.jobSkills,
      }),
    };
  }

  private async askOwnKey(userId: number, prompt: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { aiProvider: true },
    });
    const provider = AI_PROVIDERS[user.aiProvider];
    const saved = await this.apiKeys.aiKey(userId, provider.kind);
    if (!saved) {
      throw apiError(BadRequestException, 'AI_KEY_MISSING', 'Save your AI key in Settings first');
    }
    try {
      return await completeWithKey(
        user.aiProvider,
        saved.key,
        saved.model ?? provider.defaultModel,
        prompt,
      );
    } catch (error) {
      if (!(error instanceof AiCallError)) throw error;
      throw apiError(BadRequestException, 'AI_CALL_FAILED', error.message, {
        reason: error.message,
      });
    }
  }

  /** The section, its prompt and what the fact check compares with, for one resume. */
  private async improveContext(userId: number, input: ImproveSectionInput) {
    const jobId = input.jobId ?? null;
    const me = await this.me(userId);
    let doc: BuilderDoc;
    let language: string;
    let jobAd: { title: string; company: string; description: string } | null = null;
    const terms: { term: string; youHave: boolean }[] = [];
    let jobSkills: string[] = [];
    if (jobId) {
      const [built, job, found] = await Promise.all([
        this.getJob(userId, jobId),
        this.prisma.job.findFirstOrThrow({
          where: { id: jobId, ...listedFor(userId) },
          select: { title: true, description: true, company: { select: { name: true } } },
        }),
        this.insights.forJob(userId, jobId),
      ]);
      doc = read(built.doc);
      language = built.language;
      jobAd = { title: job.title, company: job.company.name, description: job.description ?? '' };
      terms.push(...found.skills, ...found.keywords);
      jobSkills = found.skills.map((s) => s.term);
    } else {
      const built = await this.get(userId, input.language);
      doc = read(built.doc);
      language = built.language;
    }
    const section = doc.sections.find((s) => s.id === input.sectionId);
    if (!section) {
      throw apiError(NotFoundException, 'SECTION_NOT_FOUND', 'That section is not in this resume');
    }
    const before = sectionMarkdown(section);
    const have = terms.filter((t) => t.youHave).map((t) => t.term);
    const facts = await this.factSources(userId, me, doc, have);
    return {
      section,
      before,
      jobSkills,
      prompt: buildImprovePrompt({
        section: before,
        language,
        job: jobAd,
        // Only terms you ticked or your profile has: never a skill the resume would invent.
        mustAdd: [...new Set(have)].filter((term) => !mentions(before, term)),
        achievements: facts.achievements,
        instruction: input.instruction ?? '',
      }),
      sources: facts.sources,
    };
  }

  /**
   * What you have told us, which the fact check compares a suggestion with: this resume, your
   * master resumes, the terms you ticked, your profile and your achievements. Anything in a
   * suggestion beyond it gets flagged.
   */
  private async factSources(userId: number, me: Me, doc: BuilderDoc, have: string[]) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        achievements: true,
        skills: true,
        keywords: true,
        headline: true,
        yearsExperience: true,
      },
    });
    return {
      achievements: achievementLines(profile?.achievements ?? ''),
      sources: [
        toMarkdown(doc),
        me.mainText,
        ...me.others.values(),
        ...have,
        ...(profile?.skills ?? []),
        ...(profile?.keywords ?? []),
        profile?.achievements ?? '',
        ...me.languages,
        profile?.headline ?? '',
        profile?.yearsExperience ? `${String(profile.yearsExperience)} years` : '',
      ],
    };
  }

  /** This job's cover letter. A letter belongs to the job's resume copy. */
  async getLetter(userId: number, jobId: string): Promise<JobCoverLetterModel> {
    const [me, job, row] = await Promise.all([
      this.me(userId),
      this.job(userId, jobId),
      this.prisma.jobResume.findUnique({
        where: { userId_jobId: { userId, jobId } },
        select: { coverLetter: true, updatedAt: true },
      }),
    ]);
    const text = letterParagraphs(row?.coverLetter ?? '').join('\n\n');
    return {
      jobId,
      title: job.title,
      company: job.company.name,
      language: this.pick(me, job.language),
      text,
      hasCopy: !!row,
      savedAt: row?.updatedAt ?? null,
    };
  }

  /** Saves the letter for this job. Needs a resume copy first: the letter is stored with it. */
  async saveLetter(userId: number, jobId: string, text: string): Promise<JobCoverLetterModel> {
    await this.job(userId, jobId);
    tooLongLetter(text);
    const { count } = await this.prisma.jobResume.updateMany({
      where: { userId, jobId },
      data: { coverLetter: letterParagraphs(text).join('\n\n') },
    });
    if (count === 0) {
      throw apiError(
        BadRequestException,
        'JOB_RESUME_MISSING',
        'Start a resume copy for this job first',
      );
    }
    return this.getLetter(userId, jobId);
  }

  /** Your cover letter template in this language (empty until you write one). */
  async getTemplate(userId: number, language: string): Promise<CoverLetterTemplateModel> {
    const lang = this.pick(await this.me(userId), language);
    const row = await this.prisma.coverLetterTemplate.findUnique({
      where: { userId_language: { userId, language: lang } },
    });
    return {
      language: lang,
      text: letterParagraphs(row?.text ?? '').join('\n\n'),
      savedAt: row?.updatedAt ?? null,
    };
  }

  /** Saves your cover letter template in this language. */
  async saveTemplate(
    userId: number,
    language: string,
    text: string,
  ): Promise<CoverLetterTemplateModel> {
    const lang = this.pick(await this.me(userId), language);
    tooLongLetter(text);
    const clean = letterParagraphs(text).join('\n\n');
    await this.prisma.coverLetterTemplate.upsert({
      where: { userId_language: { userId, language: lang } },
      create: { userId, language: lang, text: clean },
      update: { text: clean },
    });
    return this.getTemplate(userId, lang);
  }

  /** The template as a PDF in your cover letter layout, with a sample company and job. */
  async templatePdf(userId: number, language: string): Promise<BuilderPdf> {
    const { text, language: lang } = await this.getTemplate(userId, language);
    if (!text) {
      throw apiError(NotFoundException, 'COVER_LETTER_MISSING', 'No cover letter template yet');
    }
    const file = await this.documents.letterTemplatePdf(userId, text, lang);
    const pages = (await PDFDocument.load(file.bytes, { updateMetadata: false })).getPageCount();
    return { ...file, pages };
  }

  /** The saved letter as a PDF in your cover letter layout, with its page count. */
  async letterPdf(userId: number, jobId: string): Promise<BuilderPdf> {
    const file = await this.documents.jobPdf(userId, jobId, 'cover-letter');
    const pages = (await PDFDocument.load(file.bytes, { updateMetadata: false })).getPageCount();
    return { ...file, pages };
  }

  /** The AI chat prompt that writes or improves this job's cover letter. */
  async letterPrompt(userId: number, input: ImproveLetterInput): Promise<string> {
    return (await this.letterContext(userId, input)).prompt;
  }

  /**
   * Writes or improves the cover letter: from the AI chat reply you pasted, or, without one, by
   * asking your own saved AI key. Nothing is saved here: you keep or discard it on screen.
   */
  async improveLetter(userId: number, input: ImproveLetterInput): Promise<LetterSuggestionModel> {
    const ctx = await this.letterContext(userId, input);
    const reply = input.reply?.trim()
      ? input.reply.slice(0, 60_000)
      : await this.askOwnKey(userId, ctx.prompt);
    const after = readLetter(reply);
    if (!after) {
      throw apiError(BadRequestException, 'SUGGESTION_UNREADABLE', 'The reply has no letter in it');
    }
    return {
      before: ctx.before,
      after,
      findings: factCheck({
        resume: '',
        coverLetter: after,
        sources: ctx.sources,
        jobSkills: ctx.jobSkills,
      }),
    };
  }

  private async letterContext(userId: number, input: ImproveLetterInput) {
    const [built, job, found, letter, me] = await Promise.all([
      this.getJob(userId, input.jobId),
      this.prisma.job.findFirstOrThrow({
        where: { id: input.jobId, ...listedFor(userId) },
        select: { title: true, description: true, company: { select: { name: true } } },
      }),
      this.insights.forJob(userId, input.jobId),
      this.getLetter(userId, input.jobId),
      this.me(userId),
    ]);
    const doc = read(built.doc);
    const have = [...found.skills, ...found.keywords].filter((t) => t.youHave).map((t) => t.term);
    const facts = await this.factSources(userId, me, doc, have);
    const resume = toMarkdown(doc);
    return {
      before: letter.text,
      jobSkills: found.skills.map((s) => s.term),
      sources: facts.sources,
      prompt: buildLetterPrompt({
        language: letter.language,
        job: { title: job.title, company: job.company.name, description: job.description ?? '' },
        resume,
        letter: letter.text,
        mustAdd: [...new Set(have)],
        achievements: facts.achievements,
        instruction: input.instruction ?? '',
      }),
    };
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

  /** Your job copies, newest first: the Resume page switcher lists them. */
  async jobCopies(userId: number): Promise<JobResumeCopyModel[]> {
    const rows = await this.prisma.jobResume.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: JOB_COPIES_LISTED,
      select: {
        jobId: true,
        updatedAt: true,
        job: { select: { title: true, company: { select: { name: true } } } },
      },
    });
    return rows.map((row) => ({
      jobId: row.jobId,
      title: row.job.title,
      company: row.job.company.name,
      savedAt: row.updatedAt,
    }));
  }

  /**
   * Your resume for one job. A job you wrote a resume for in the Apply kit has one already; it is
   * read into sections the first time. Without one, `doc` is your master resume and `hasCopy` is
   * false until you start a copy.
   */
  async getJob(userId: number, jobId: string): Promise<JobResumeBuildModel> {
    const [me, job, row] = await Promise.all([
      this.me(userId),
      this.job(userId, jobId),
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
    await this.job(userId, jobId);
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

  /** A job on your list; someone else's job is "not found", like a wrong id. */
  private async job(userId: number, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, ...listedFor(userId) },
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
