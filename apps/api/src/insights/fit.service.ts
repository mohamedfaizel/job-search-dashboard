import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resumeFor } from '../profile/resumes';
import { CorpusService } from './corpus.service';
import { checkResume } from './score';
import { jobTerms } from './terms';

/**
 * Fit %: the job popup's score for every job at once, kept in the JobFit table so the jobs
 * table can sort and filter by it. No AI, so it costs nothing.
 *
 * Scores go stale when your resume changes, when you remove or restore a term with ×, and when
 * jobs are added or changed (new descriptions change every job's keywords). Rather than every
 * one of those places remembering to recalculate, `ensureFresh` compares a stamp of all three
 * with the stamp of the last run and recalculates only when it differs.
 */
@Injectable()
export class FitService {
  private readonly logger = new Logger(FitService.name);
  /** The stamp each user's scores were last worked out for. */
  private readonly done = new Map<number, string>();
  /** A run in progress, so two requests at once share it instead of starting two. */
  private readonly running = new Map<number, { stamp: string; promise: Promise<void> }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly corpora: CorpusService,
  ) {}

  /** Makes sure the user's Fit scores match their resume, removed terms and the jobs. */
  async ensureFresh(userId: number): Promise<void> {
    const stamp = await this.stamp(userId);
    if (this.done.get(userId) === stamp) return;
    const current = this.running.get(userId);
    if (current?.stamp === stamp) return current.promise;

    const promise = this.recalculate(userId)
      .then(() => {
        this.done.set(userId, stamp);
      })
      .finally(() => {
        if (this.running.get(userId)?.promise === promise) this.running.delete(userId);
      });
    this.running.set(userId, { stamp, promise });
    return promise;
  }

  /** Starts `ensureFresh` without waiting, e.g. right after a resume upload. */
  warm(userId: number): void {
    this.ensureFresh(userId).catch((error: unknown) => {
      this.logger.warn(
        `Could not work out Fit scores for user ${String(userId)}: ${String(error)}`,
      );
    });
  }

  /** Works the scores out again even if nothing seems to have changed. Returns how many. */
  async forceRecalculate(userId: number): Promise<number> {
    this.done.delete(userId);
    await this.ensureFresh(userId);
    return this.prisma.jobFit.count({ where: { userId } });
  }

  /** Changes whenever anything the scores depend on changes. */
  private async stamp(userId: number): Promise<string> {
    const [profile, others, removed, jobs] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { updatedAt: true } }),
      this.prisma.languageResume.aggregate({
        where: { userId },
        _count: true,
        _max: { updatedAt: true },
      }),
      this.prisma.removedTerm.aggregate({
        where: { userId },
        _count: true,
        _max: { createdAt: true },
      }),
      this.prisma.job.aggregate({ _count: true, _max: { updatedAt: true } }),
    ]);
    return [
      profile?.updatedAt.toISOString() ?? '',
      others._count,
      others._max.updatedAt?.toISOString() ?? '',
      removed._count,
      removed._max.createdAt?.toISOString() ?? '',
      jobs._count,
      jobs._max.updatedAt?.toISOString() ?? '',
    ].join('|');
  }

  /**
   * Scores every job against the user's master resume (in the ad's language when they have it)
   * and skills, and replaces their JobFit rows.
   */
  private async recalculate(userId: number): Promise<void> {
    const started = Date.now();
    const [profile, others, removedRows] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { resumeText: true, resumeLanguage: true, skills: true },
      }),
      this.prisma.languageResume.findMany({
        where: { userId },
        select: { language: true, text: true },
      }),
      this.prisma.removedTerm.findMany({ where: { userId }, select: { jobId: true, term: true } }),
    ]);
    const resume = profile?.resumeText ?? '';
    // Each job is scored against your resume in its ad's language when you have one.
    const resumes = {
      language: profile?.resumeLanguage ?? 'en',
      text: resume,
      others: new Map(others.map((r) => [r.language, r.text])),
    };
    // Skills you said you have ("I have this") count as covered, like in the job popup.
    const skills = profile?.skills ?? [];
    if (!resume.trim()) {
      // No resume, nothing to score: the Fit column shows a dash.
      await this.prisma.jobFit.deleteMany({ where: { userId } });
      return;
    }

    const everywhere = new Set(removedRows.filter((r) => r.jobId === null).map((r) => r.term));
    const perJob = new Map<string, string[]>();
    for (const { jobId, term } of removedRows) {
      if (jobId !== null) perJob.set(jobId, [...(perJob.get(jobId) ?? []), term]);
    }

    const [corpus, jobs] = await Promise.all([
      this.corpora.corpus(),
      this.prisma.job.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          language: true,
          skills: true,
          city: true,
          raw: true,
          company: { select: { name: true } },
        },
      }),
    ]);

    const rows: { userId: number; jobId: string; score: number }[] = [];
    for (const job of jobs) {
      const removed = new Set([...everywhere, ...(perJob.get(job.id) ?? [])]);
      const terms = jobTerms(job, removed, corpus);
      const { score } = checkResume(resumeFor(resumes, terms.language).text, terms, skills);
      if (score !== null) rows.push({ userId, jobId: job.id, score });
    }
    await this.prisma.$transaction([
      this.prisma.jobFit.deleteMany({ where: { userId } }),
      this.prisma.jobFit.createMany({ data: rows }),
    ]);
    this.logger.log(
      `Worked out Fit for ${String(rows.length)} jobs in ${String(Date.now() - started)} ms`,
    );
  }
}
