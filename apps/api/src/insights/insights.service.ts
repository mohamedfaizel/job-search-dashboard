import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JobInsightsModel, RemovedTermModel, TermCheckModel } from './insights.model';
import { buildResumePrompt } from './prompt';
import { coverage, matchScore, titleMatch } from './score';
import { mentions } from './skills';
import { detectLanguage, keywordTokens } from './text';
import type { DocumentFrequencies } from './tfidf';
import { documentFrequencies, rankTerms } from './tfidf';

/** How many TF-IDF keywords to show for a job. */
const KEYWORD_COUNT = 15;

@Injectable()
export class InsightsService {
  // Counting words in every description is the slow part, so it is kept until a job changes.
  private cache: { key: string; frequencies: DocumentFrequencies } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async forJob(userId: number, jobId: string): Promise<JobInsightsModel> {
    const [job, profile, removedRows] = await Promise.all([
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
      this.prisma.profile.findUnique({ where: { userId }, select: { resumeText: true } }),
      this.prisma.removedTerm.findMany({
        where: { userId, OR: [{ jobId }, { jobId: null }] },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    const raw = (job.raw ?? {}) as { normalized_title?: string; keyword_slugs?: string[] };
    const resume = profile?.resumeText ?? '';
    const language = job.language ?? detectLanguage(job.description);
    const check = (term: string): TermCheckModel => ({ term, inResume: mentions(resume, term) });

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
    const frequencies = await this.frequencies();
    const keywords = rankTerms(keywordTokens(job.description ?? '', language), frequencies)
      .map((ranked) => ranked.term)
      .filter((term) => !known.has(term) && !removed.has(term))
      .slice(0, KEYWORD_COUNT);

    const skills = tags.map(check);
    const keywordChecks = keywords.map(check);
    const hasResume = resume.trim().length > 0;
    const skillsCoverage = hasResume ? coverage(skills) : null;
    const keywordsCoverage = hasResume ? coverage(keywordChecks) : null;
    const normalizedTitle =
      raw.normalized_title && raw.normalized_title !== job.title ? raw.normalized_title : null;
    const titleCoverage = hasResume
      ? titleMatch(normalizedTitle ?? job.title, resume, language)
      : null;
    const missing = (terms: TermCheckModel[]) =>
      terms.filter((t) => !hasResume || !t.inResume).map((t) => t.term);

    return {
      jobId,
      title: job.title,
      normalizedTitle,
      language,
      languageDetected: !job.language && !!language,
      hasResume,
      skills,
      keywords: keywordChecks,
      removed: [...removed.values()],
      skillsCoverage,
      keywordsCoverage,
      titleMatch: titleCoverage,
      score: hasResume
        ? matchScore({ keywords: keywordsCoverage, skills: skillsCoverage, title: titleCoverage })
        : null,
      prompt: buildResumePrompt({
        title: job.title,
        company: job.company.name,
        city: job.city,
        language,
        missingSkills: missing(skills),
        missingKeywords: missing(keywordChecks),
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
    if (!(await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true } }))) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
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

  /** Word counts over every job description, rebuilt only when jobs were added or changed. */
  private async frequencies(): Promise<DocumentFrequencies> {
    const stats = await this.prisma.job.aggregate({ _count: true, _max: { updatedAt: true } });
    const key = `${stats._count}:${stats._max.updatedAt?.toISOString() ?? ''}`;
    if (this.cache?.key === key) return this.cache.frequencies;

    const jobs = await this.prisma.job.findMany({
      where: { description: { not: null } },
      select: { description: true, language: true },
    });
    const frequencies = documentFrequencies(
      jobs.map((j) => keywordTokens(j.description ?? '', j.language)),
    );
    this.cache = { key, frequencies };
    return frequencies;
  }
}
