import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { tidy } from '../profile/resume-text';
import { germanRequirement } from './german';
import type {
  JobInsightsModel,
  JobResumeModel,
  RemovedTermModel,
  TermCheckModel,
} from './insights.model';
import { buildResumePrompt } from './prompt';
import type { ResumeCheck } from './score';
import { checkResume } from './score';
import { KNOWN_SKILLS, relatedTo } from './skills';
import { detectLanguage, keywordTokens } from './text';
import type { DocumentFrequencies } from './tfidf';
import { documentFrequencies, rankTerms } from './tfidf';

/** How many TF-IDF keywords to show for a job. */
const KEYWORD_COUNT = 15;

/** What we learn from all saved jobs at once. */
interface Corpus {
  frequencies: DocumentFrequencies;
  /** Every city a job is in: a place is never a keyword, for any job. */
  cities: Set<string>;
  /** Every skill tag JobsPipe gave any job, plus the skills we know: tools rank first. */
  skills: Set<string>;
}

/** Longer than any real resume, short enough to keep junk out. */
export const MAX_RESUME_CHARS = 50_000;

/** A resume file: what was uploaded, or what a download sends. */
export interface JobResumeFile {
  name: string;
  type: string;
  bytes: Buffer;
}

@Injectable()
export class InsightsService {
  // Counting words in every description is the slow part, so it is kept until a job changes.
  private cache: { key: string; corpus: Corpus } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async forJob(userId: number, jobId: string): Promise<JobInsightsModel> {
    const [job, profile, removedRows, jobResume] = await Promise.all([
      this.prisma.job.findUnique({
        where: { id: jobId },
        select: {
          title: true,
          description: true,
          language: true,
          skills: true,
          city: true,
          raw: true,
          company: { select: { name: true } },
        },
      }),
      this.prisma.profile.findUnique({
        where: { userId },
        select: { resumeText: true, skills: true, languages: true },
      }),
      this.prisma.removedTerm.findMany({
        where: { userId, OR: [{ jobId }, { jobId: null }] },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.jobResume.findUnique({
        where: { userId_jobId: { userId, jobId } },
        select: { text: true, fileName: true, updatedAt: true },
      }),
    ]);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    const raw = (job.raw ?? {}) as { normalized_title?: string; keyword_slugs?: string[] };
    const resume = profile?.resumeText ?? '';
    const otherSkills = profile?.skills ?? [];
    const language = job.language ?? detectLanguage(job.description);
    const german = germanRequirement(job.description, language);

    // Terms you removed with × leave both lists. One removed everywhere wins over this job's.
    const removed = new Map<string, RemovedTermModel>();
    for (const row of removedRows) {
      const everywhere = row.jobId === null || removed.get(row.term)?.everywhere === true;
      removed.set(row.term, { term: row.term, everywhere });
    }

    // JobsPipe's technology tags first, then its wider keyword tags ("mentoring", "ecommerce").
    const tags = [
      ...new Set([...job.skills, ...(raw.keyword_slugs ?? [])].map((s) => s.toLowerCase())),
    ].filter((tag) => !removed.has(tag));

    // The company's own name and the city say nothing about the skills the job needs.
    const known = new Set([
      ...tags,
      ...keywordTokens(`${job.company.name} ${job.city ?? ''}`, null),
    ]);
    const corpus = await this.corpus();
    const candidates = rankTerms(keywordTokens(job.description ?? '', language), corpus.frequencies)
      .map((ranked) => ranked.term)
      .filter((term) => !known.has(term) && !corpus.cities.has(term) && !removed.has(term));
    // Tools and technologies first, then the other words, each group in TF-IDF order.
    const keywords = [
      ...candidates.filter((term) => corpus.skills.has(term)),
      ...candidates.filter((term) => !corpus.skills.has(term)),
    ].slice(0, KEYWORD_COUNT);

    const normalizedTitle =
      raw.normalized_title && raw.normalized_title !== job.title ? raw.normalized_title : null;
    const terms = { skills: tags, keywords, title: normalizedTitle ?? job.title, language };
    const before = checkResume(resume, terms);
    // A missing term next to a skill you have ("apollo" with "graphql") gets a hint.
    const yourSkills = [resume, ...otherSkills].join('\n');
    const withHint = (checks: TermCheckModel[]) =>
      checks.map(({ term, inResume }) => ({
        term,
        inResume,
        relatedTo: inResume ? null : relatedTo(term, yourSkills),
      }));
    const hasResume = resume.trim().length > 0;
    const missing = (checks: TermCheckModel[]) =>
      checks.filter((t) => !hasResume || !t.inResume).map((t) => t.term);

    return {
      jobId,
      title: job.title,
      normalizedTitle,
      language,
      languageDetected: !job.language && !!language,
      germanRequired: german.required,
      germanLevel: german.level,
      resumeLanguage: german.required ? 'de' : 'en',
      hasResume,
      skills: withHint(before.skillChecks),
      keywords: withHint(before.keywordChecks),
      removed: [...removed.values()],
      skillsCoverage: before.skills,
      keywordsCoverage: before.keywords,
      titleMatch: before.title,
      score: before.score,
      jobResume: jobResume && this.afterScore(jobResume, terms, before),
      prompt: buildResumePrompt({
        title: job.title,
        company: job.company.name,
        city: job.city,
        resumeLanguage: german.required ? 'de' : 'en',
        germanLevel: german.level,
        languages: profile?.languages ?? [],
        missingSkills: missing(before.skillChecks),
        missingKeywords: missing(before.keywordChecks),
        otherSkills,
        resume,
        description: job.description,
      }),
    };
  }

  /**
   * Removes a skill or keyword from a job's insights: from this job only, or from every job.
   * Removing it again does nothing.
   */
  async removeTerm(userId: number, jobId: string, term: string, everywhere: boolean) {
    const clean = term.trim().toLowerCase();
    if (!clean || clean.length > 100)
      throw new BadRequestException('A term is 1 to 100 characters');
    const scope = everywhere ? null : jobId;
    await this.assertJob(jobId);
    const existing = await this.prisma.removedTerm.findFirst({
      where: { userId, jobId: scope, term: clean },
    });
    if (!existing) {
      await this.prisma.removedTerm.create({ data: { userId, jobId: scope, term: clean } });
    }
    return this.forJob(userId, jobId);
  }

  /** Puts a removed term back, both for this job and everywhere. */
  async restoreTerm(userId: number, jobId: string, term: string) {
    await this.prisma.removedTerm.deleteMany({
      where: { userId, term: term.trim().toLowerCase(), OR: [{ jobId }, { jobId: null }] },
    });
    return this.forJob(userId, jobId);
  }

  /**
   * Saves the resume you wrote for a job, replacing the one before. Pasted text comes without a
   * file; an upload keeps its file so it can be downloaded again.
   */
  async saveJobResume(userId: number, jobId: string, text: string, file?: JobResumeFile) {
    const clean = tidy(text);
    if (!clean) throw new BadRequestException('The resume is empty');
    if (clean.length > MAX_RESUME_CHARS) {
      throw new BadRequestException(`A resume is at most ${String(MAX_RESUME_CHARS)} characters`);
    }
    await this.assertJob(jobId);
    const data = {
      text: clean,
      fileName: file?.name ?? null,
      file: file ? new Uint8Array(file.bytes) : null,
      fileType: file?.type ?? null,
    };
    await this.prisma.jobResume.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId, ...data },
      update: data,
    });
    return this.forJob(userId, jobId);
  }

  /** Deletes the resume you wrote for a job. Deleting again does nothing. */
  async deleteJobResume(userId: number, jobId: string) {
    await this.prisma.jobResume.deleteMany({ where: { userId, jobId } });
    return this.forJob(userId, jobId);
  }

  /** The resume you wrote for a job, as a file: the uploaded one, or the pasted text as .txt. */
  async jobResumeFile(userId: number, jobId: string): Promise<JobResumeFile> {
    const row = await this.prisma.jobResume.findUnique({
      where: { userId_jobId: { userId, jobId } },
      select: { text: true, fileName: true, file: true, fileType: true },
    });
    if (!row) throw new NotFoundException('No resume saved for this job');
    if (row.file && row.fileName) {
      return {
        name: row.fileName,
        type: row.fileType ?? 'application/octet-stream',
        bytes: Buffer.from(row.file),
      };
    }
    return {
      name: 'resume.txt',
      type: 'text/plain; charset=utf-8',
      bytes: Buffer.from(row.text, 'utf8'),
    };
  }

  private async assertJob(jobId: string) {
    if (!(await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true } }))) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
  }

  /** Scores the resume you wrote for the job, and what changed from your profile resume. */
  private afterScore(
    jobResume: { text: string; fileName: string | null; updatedAt: Date },
    terms: Parameters<typeof checkResume>[1],
    before: ResumeCheck,
  ): JobResumeModel {
    const after = checkResume(jobResume.text, terms);
    const beforeChecks = [...before.skillChecks, ...before.keywordChecks];
    const afterChecks = [...after.skillChecks, ...after.keywordChecks];
    return {
      fileName: jobResume.fileName,
      updatedAt: jobResume.updatedAt,
      skillsCoverage: after.skills,
      keywordsCoverage: after.keywords,
      titleMatch: after.title,
      score: after.score,
      nowCovered: afterChecks
        .filter((t, i) => t.inResume && !beforeChecks[i]?.inResume)
        .map((t) => t.term),
      stillMissing: afterChecks.filter((t) => !t.inResume).map((t) => t.term),
    };
  }

  /** Word counts, cities and skill tags over every job, rebuilt only when jobs change. */
  private async corpus(): Promise<Corpus> {
    const stats = await this.prisma.job.aggregate({ _count: true, _max: { updatedAt: true } });
    const key = `${stats._count}:${stats._max.updatedAt?.toISOString() ?? ''}`;
    if (this.cache?.key === key) return this.cache.corpus;

    const jobs = await this.prisma.job.findMany({
      select: { description: true, language: true, city: true, skills: true },
    });
    const corpus: Corpus = {
      frequencies: documentFrequencies(
        jobs
          .filter((j) => j.description)
          .map((j) => keywordTokens(j.description ?? '', j.language)),
      ),
      cities: new Set(jobs.flatMap((j) => (j.city ? keywordTokens(j.city, null) : []))),
      skills: new Set([
        ...KNOWN_SKILLS,
        ...jobs.flatMap((j) => j.skills.map((s) => s.toLowerCase())),
      ]),
    };
    this.cache = { key, corpus };
    return corpus;
  }
}
