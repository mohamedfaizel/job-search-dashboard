import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { JobMatch } from '../generated/prisma/client';
import { JobMatchStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { describeError, describeRunError, ResumeMatcherClient } from './resume-matcher.client';
import type { JobMatchModel } from './resume-matcher.model';
import type { RmJobInput } from './rm-job';
import { loadRmJobInput, withRmJob } from './rm-job';

const INTERRUPTED_MESSAGE = 'The API restarted while this match was running. Match again.';
const NO_SCORE_MESSAGE = "Resume-Matcher tailored your resume but couldn't score it. Match again.";

const EMPTY_RESULT = {
  error: null,
  score: null,
  keywordMatchBefore: null,
  keywordMatch: null,
  skillsCoverage: null,
  titleMatch: null,
  sectionCompleteness: null,
  dateConsistency: null,
  missingKeywords: [],
  injectableKeywords: [],
  recommendations: [],
  finishedAt: null,
};

/**
 * Scores your master resume against one job with Resume-Matcher. That takes a minute or two
 * (several AI calls), longer than a browser should wait on one request, so `start` saves a
 * PENDING row and returns at once; the work carries on in the background and the page polls
 * `get` until the row is READY or FAILED.
 */
@Injectable()
export class JobMatchService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobMatchService.name);
  /** "userId:jobId" for every match running in this process. */
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ResumeMatcherClient,
  ) {}

  /** Background work dies with the process, so a PENDING row left from before can't finish. */
  async onApplicationBootstrap(): Promise<void> {
    await this.prisma.jobMatch.updateMany({
      where: { status: JobMatchStatus.PENDING },
      data: { status: JobMatchStatus.FAILED, error: INTERRUPTED_MESSAGE, finishedAt: new Date() },
    });
  }

  async get(userId: number, jobId: string): Promise<JobMatchModel | null> {
    const [match, resume] = await Promise.all([
      this.prisma.jobMatch.findUnique({ where: { userId_jobId: { userId, jobId } } }),
      this.prisma.matcherResume.findUnique({ where: { userId }, select: { syncedAt: true } }),
    ]);
    return match ? toModel(match, resume?.syncedAt ?? null) : null;
  }

  async start(userId: number, jobId: string): Promise<JobMatchModel> {
    const key = `${userId}:${jobId}`;
    // A second click while it runs just shows the match that is already going.
    if (this.running.has(key)) {
      const current = await this.get(userId, jobId);
      if (current) return current;
    }

    const [input, previous] = await Promise.all([
      loadRmJobInput(this.prisma, userId, jobId),
      this.prisma.jobMatch.findUnique({ where: { userId_jobId: { userId, jobId } } }),
    ]);

    const data = {
      ...EMPTY_RESULT,
      status: JobMatchStatus.PENDING,
      resumeFileName: input.resumeFileName,
      startedAt: new Date(),
    };
    const match = await this.prisma.jobMatch.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId, ...data },
      update: data,
    });

    this.running.add(key);
    // Not awaited on purpose: the request returns now and the page polls for the result.
    void this.run(userId, jobId, input, previous?.rmJobId ?? null).finally(() =>
      this.running.delete(key),
    );

    return toModel(match, input.resumeSyncedAt);
  }

  /** Never throws: every outcome, good or bad, ends up on the row. */
  private async run(
    userId: number,
    jobId: string,
    input: RmJobInput,
    rmJobId: string | null,
  ): Promise<void> {
    // Reusing Resume-Matcher's copy of the job saves extracting its keywords again.
    const ref = { rmJobId };
    try {
      const preview = await withRmJob(this.client, input, ref, (id) =>
        this.client.improvePreview(input.rmResumeId, id),
      );
      const ats = preview.data.ats_score;
      if (!ats) throw new Error(NO_SCORE_MESSAGE);
      await this.save(userId, jobId, {
        status: JobMatchStatus.READY,
        rmJobId: ref.rmJobId,
        score: ats.overall_score,
        keywordMatchBefore: preview.data.refinement_stats?.initial_match_percentage ?? null,
        keywordMatch: ats.sub_scores.keyword_match,
        skillsCoverage: ats.sub_scores.skills_coverage,
        titleMatch: ats.sub_scores.title_match,
        sectionCompleteness: ats.sub_scores.section_completeness,
        dateConsistency: ats.sub_scores.date_consistency,
        missingKeywords: ats.missing_keywords,
        injectableKeywords: ats.injectable_keywords,
        recommendations: ats.recommendations,
      });
    } catch (error) {
      this.logger.warn(`Match ${userId}:${jobId} failed: ${describeError(error)}`);
      await this.save(userId, jobId, {
        status: JobMatchStatus.FAILED,
        rmJobId: ref.rmJobId,
        error: describeRunError(error),
      }).catch((e: unknown) => {
        // The job or user was deleted meanwhile; there is nothing left to update.
        this.logger.warn(`Could not save match ${userId}:${jobId}: ${describeError(e)}`);
      });
    }
  }

  private async save(
    userId: number,
    jobId: string,
    data: Partial<Omit<JobMatch, 'userId' | 'jobId'>>,
  ): Promise<void> {
    await this.prisma.jobMatch.update({
      where: { userId_jobId: { userId, jobId } },
      data: { ...data, finishedAt: new Date() },
    });
  }
}

function toModel(match: JobMatch, resumeSyncedAt: Date | null): JobMatchModel {
  return {
    jobId: match.jobId,
    status: match.status,
    error: match.error,
    score: match.score,
    keywordMatchBefore: match.keywordMatchBefore,
    keywordMatch: match.keywordMatch,
    skillsCoverage: match.skillsCoverage,
    titleMatch: match.titleMatch,
    sectionCompleteness: match.sectionCompleteness,
    dateConsistency: match.dateConsistency,
    missingKeywords: match.missingKeywords,
    injectableKeywords: match.injectableKeywords,
    recommendations: match.recommendations,
    resumeFileName: match.resumeFileName,
    startedAt: match.startedAt,
    finishedAt: match.finishedAt,
    outdated: resumeSyncedAt !== null && resumeSyncedAt > match.startedAt,
  };
}
