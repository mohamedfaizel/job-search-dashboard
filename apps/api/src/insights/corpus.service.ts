import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Corpus } from './terms';
import { buildCorpus } from './terms';

/** Word counts, cities and skill tags over every job, shared by the job popup and Fit scores. */
@Injectable()
export class CorpusService {
  // Counting words in every description is the slow part, so it is kept until a job changes.
  private cache: { key: string; corpus: Corpus } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Rebuilt only when a job is added or changed. */
  async corpus(): Promise<Corpus> {
    const stats = await this.prisma.job.aggregate({ _count: true, _max: { updatedAt: true } });
    const key = `${stats._count}:${stats._max.updatedAt?.toISOString() ?? ''}`;
    if (this.cache?.key === key) return this.cache.corpus;

    const jobs = await this.prisma.job.findMany({
      select: { description: true, language: true, city: true, skills: true },
    });
    const corpus = buildCorpus(jobs);
    this.cache = { key, corpus };
    return corpus;
  }
}
