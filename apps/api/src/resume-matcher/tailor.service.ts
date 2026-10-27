import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import type { TailoredResume } from '../generated/prisma/client';
import { JobMatchStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  describeError,
  describeRunError,
  ResumeMatcherClient,
  ResumeMatcherHttpError,
} from './resume-matcher.client';
import type { TailoredResumeModel } from './resume-matcher.model';
import type { RmJobInput } from './rm-job';
import { loadRmJobInput, withRmJob } from './rm-job';

const INTERRUPTED_MESSAGE = 'The API restarted while your resume was being tailored. Try again.';

/**
 * Has Resume-Matcher rewrite your master resume for one job, save it, and write a cover letter.
 * Like matching, it takes a minute or two, so `start` returns a PENDING row at once and the
 * work carries on in the background. The PDFs are printed by Resume-Matcher on download.
 */
@Injectable()
export class TailorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TailorService.name);
  /** "userId:jobId" for every tailoring running in this process. */
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ResumeMatcherClient,
  ) {}

  /** Background work dies with the process, so a PENDING row left from before can't finish. */
  async onApplicationBootstrap(): Promise<void> {
    await this.prisma.tailoredResume.updateMany({
      where: { status: JobMatchStatus.PENDING },
      data: { status: JobMatchStatus.FAILED, error: INTERRUPTED_MESSAGE, finishedAt: new Date() },
    });
  }

  async get(userId: number, jobId: string): Promise<TailoredResumeModel | null> {
    const [row, resume] = await Promise.all([
      this.prisma.tailoredResume.findUnique({ where: { userId_jobId: { userId, jobId } } }),
      this.prisma.matcherResume.findUnique({ where: { userId }, select: { syncedAt: true } }),
    ]);
    return row ? toModel(row, resume?.syncedAt ?? null) : null;
  }

  async start(userId: number, jobId: string): Promise<TailoredResumeModel> {
    const key = `${userId}:${jobId}`;
    // A second click while it runs just shows the one that is already going.
    if (this.running.has(key)) {
      const current = await this.get(userId, jobId);
      if (current) return current;
    }

    const [input, previous, match] = await Promise.all([
      loadRmJobInput(this.prisma, userId, jobId),
      this.prisma.tailoredResume.findUnique({ where: { userId_jobId: { userId, jobId } } }),
      this.prisma.jobMatch.findUnique({
        where: { userId_jobId: { userId, jobId } },
        select: { rmJobId: true },
      }),
    ]);

    const data = {
      status: JobMatchStatus.PENDING,
      error: null,
      rmResumeId: null,
      score: null,
      coverLetter: null,
      resumeFileName: input.resumeFileName,
      startedAt: new Date(),
      finishedAt: null,
    };
    const row = await this.prisma.tailoredResume.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId, ...data },
      update: data,
    });

    this.running.add(key);
    // Not awaited on purpose: the request returns now and the page polls for the result.
    void this.run(userId, jobId, input, {
      // A match already sent this job to Resume-Matcher; reuse its copy.
      rmJobId: previous?.rmJobId ?? match?.rmJobId ?? null,
      oldRmResumeId: previous?.rmResumeId ?? null,
    }).finally(() => this.running.delete(key));

    return toModel(row, input.resumeSyncedAt);
  }

  /** The tailored resume or its cover letter as a PDF, for a download link. */
  async pdf(userId: number, jobId: string, kind: 'resume' | 'cover-letter'): Promise<Uint8Array> {
    const row = await this.prisma.tailoredResume.findUnique({
      where: { userId_jobId: { userId, jobId } },
    });
    if (row?.status !== JobMatchStatus.READY || !row.rmResumeId) {
      throw new NotFoundException('Tailor your resume for this job first.');
    }
    if (kind === 'cover-letter' && !row.coverLetter) {
      throw new NotFoundException('There is no cover letter for this job. Tailor again.');
    }
    return kind === 'resume'
      ? this.client.resumePdf(row.rmResumeId)
      : this.client.coverLetterPdf(row.rmResumeId);
  }

  /** Never throws: every outcome, good or bad, ends up on the row. */
  private async run(
    userId: number,
    jobId: string,
    input: RmJobInput,
    ids: { rmJobId: string | null; oldRmResumeId: string | null },
  ): Promise<void> {
    const ref = { rmJobId: ids.rmJobId };
    try {
      const tailored = await withRmJob(this.client, input, ref, (id) =>
        this.client.improve(input.rmResumeId, id),
      );
      const rmResumeId = tailored.data.resume_id;
      // The resume is what matters; a failed cover letter only leaves that part empty.
      const coverLetter =
        tailored.data.cover_letter ??
        (await this.client.generateCoverLetter(rmResumeId).catch((e: unknown) => {
          this.logger.warn(`Cover letter ${userId}:${jobId} failed: ${describeError(e)}`);
          return null;
        }));
      await this.save(userId, jobId, {
        status: JobMatchStatus.READY,
        rmJobId: ref.rmJobId,
        rmResumeId,
        score: tailored.data.ats_score?.overall_score ?? null,
        coverLetter,
      });
      if (ids.oldRmResumeId) await this.deleteOld(ids.oldRmResumeId);
    } catch (error) {
      this.logger.warn(`Tailoring ${userId}:${jobId} failed: ${describeError(error)}`);
      await this.save(userId, jobId, {
        status: JobMatchStatus.FAILED,
        rmJobId: ref.rmJobId,
        error: describeRunError(error),
      }).catch((e: unknown) => {
        // The job or user was deleted meanwhile; there is nothing left to update.
        this.logger.warn(`Could not save tailoring ${userId}:${jobId}: ${describeError(e)}`);
      });
    }
  }

  /** The previous tailored copy is replaced; leaving it would only clutter Resume-Matcher. */
  private async deleteOld(rmResumeId: string): Promise<void> {
    await this.client.deleteResume(rmResumeId).catch((e: unknown) => {
      if (!(e instanceof ResumeMatcherHttpError && e.rmStatus === 404)) {
        this.logger.warn(`Could not delete old tailored resume ${rmResumeId}: ${describeError(e)}`);
      }
    });
  }

  private async save(
    userId: number,
    jobId: string,
    data: Partial<Omit<TailoredResume, 'userId' | 'jobId'>>,
  ): Promise<void> {
    await this.prisma.tailoredResume.update({
      where: { userId_jobId: { userId, jobId } },
      data: { ...data, finishedAt: new Date() },
    });
  }
}

function toModel(row: TailoredResume, resumeSyncedAt: Date | null): TailoredResumeModel {
  return {
    jobId: row.jobId,
    status: row.status,
    error: row.error,
    score: row.score,
    coverLetter: row.coverLetter,
    resumeFileName: row.resumeFileName,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    outdated: resumeSyncedAt !== null && resumeSyncedAt > row.startedAt,
  };
}
