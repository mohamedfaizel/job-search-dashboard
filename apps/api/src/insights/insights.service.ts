import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JobInsightsModel, TermCheckModel } from './insights.model';
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
    const [job, profile] = await Promise.all([
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
    ]);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    const raw = (job.raw ?? {}) as { normalized_title?: string; keyword_slugs?: string[] };
    const resume = profile?.resumeText ?? '';
    const language = job.language ?? detectLanguage(job.description);
    const check = (term: string): TermCheckModel => ({ term, inResume: mentions(resume, term) });

    // JobsPipe's technology tags first, then its wider keyword tags ("mentoring", "ecommerce").
    const tags = [
      ...new Set([...job.skills, ...(raw.keyword_slugs ?? [])].map((s) => s.toLowerCase())),
    ];

    // The company's own name and the city say nothing about the skills the job needs.
    const known = new Set([
      ...tags,
      ...keywordTokens(`${job.company.name} ${job.city ?? ''}`, null),
    ]);
    const frequencies = await this.frequencies();
    const keywords = rankTerms(keywordTokens(job.description ?? '', language), frequencies)
      .map((ranked) => ranked.term)
      .filter((term) => !known.has(term))
      .slice(0, KEYWORD_COUNT);

    return {
      jobId,
      title: job.title,
      normalizedTitle:
        raw.normalized_title && raw.normalized_title !== job.title ? raw.normalized_title : null,
      language,
      languageDetected: !job.language && !!language,
      hasResume: resume.trim().length > 0,
      skills: tags.map(check),
      keywords: keywords.map(check),
    };
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
