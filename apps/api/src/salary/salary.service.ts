import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error';
import { listedFor } from '../jobs/listed-for';
import { PrismaService } from '../prisma/prisma.service';
import { buildNegotiationPrompt } from './negotiation-prompt';
import { salaryRange } from './salary';
import type { SalaryRange } from './salary';

/** Ads older than this say little about today's pay. */
const LOOKBACK_DAYS = 365;
/** Enough ads for a range, without loading the whole table. */
const MAX_ADS = 3000;

@Injectable()
export class SalaryService {
  constructor(private readonly prisma: PrismaService) {}

  async research(
    userId: number,
    jobId: string,
    now = new Date(),
  ): Promise<SalaryRange & { expectation: string; prompt: string }> {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, ...listedFor(userId) },
      include: { company: { select: { name: true } } },
    });
    if (!job)
      throw apiError(NotFoundException, 'JOB_NOT_FOUND', `Job ${jobId} not found`, { id: jobId });

    const others = await this.prisma.job.findMany({
      where: {
        id: { not: jobId },
        // Same country; without one we can only compare with other jobs without one.
        countryCode: job.countryCode,
        postedAt: { gte: new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) },
        OR: [{ salaryMinUsd: { not: null } }, { salaryMaxUsd: { not: null } }],
      },
      orderBy: { postedAt: 'desc' },
      take: MAX_ADS,
      select: {
        id: true,
        title: true,
        jobFunction: true,
        salaryMinUsd: true,
        salaryMaxUsd: true,
        salaryEstimated: true,
        postedAt: true,
        company: { select: { name: true } },
      },
    });
    const range = salaryRange(
      job,
      others.map(({ company, ...o }) => ({ ...o, company: company.name })),
    );

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        salaryExpectation: true,
        yearsExperience: true,
        languages: true,
        achievements: true,
      },
    });
    const expectation = profile?.salaryExpectation ?? '';
    const prompt = buildNegotiationPrompt({
      title: job.title,
      company: job.company.name,
      city: job.city,
      language: job.language,
      range,
      expectation,
      yearsExperience: profile?.yearsExperience ?? null,
      languages: profile?.languages ?? [],
      achievements: profile?.achievements ?? '',
    });
    return { ...range, expectation, prompt };
  }
}
