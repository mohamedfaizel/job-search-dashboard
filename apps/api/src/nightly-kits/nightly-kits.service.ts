import { Injectable, Logger } from '@nestjs/common';
import {
  type CallCost as KitCost,
  centsIn,
  costOf,
  currencyFor,
  savedPercent,
  summedCost,
} from '../api-keys/ai-cost';
import type { AiUsage } from '../api-keys/ai-providers';
import { AI_PROVIDERS, AiCallError, completeWithUsage } from '../api-keys/ai-providers';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { getErrorMessage } from '../common/errors';
import { AiProvider } from '../generated/prisma/enums';
import { InsightsService } from '../insights/insights.service';
import { ALL_KIT_PARTS, type KitParts } from '../insights/prompt';
import { NotificationsService, TOP_JOBS } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildImprovePrompt, honestMissing, MAX_IMPROVE_ROUNDS } from './improve';

export const KITS_READY = 'KITS_READY';
export const KITS_FAILED = 'KITS_FAILED';

/** A whole kit (resume, cover letter, form answers, check) is long: room for all of it. */
const KIT_MAX_TOKENS = 12_000;
/** Writing that much takes a while; one job may take up to this long. */
const KIT_TIMEOUT_MS = 5 * 60 * 1000;
/** An improve round replies with the resume only. */
const IMPROVE_MAX_TOKENS = 6_000;
/** The prompt says this when there is no resume to tailor. */
const NO_RESUME = 'I have not added my resume here yet';

/** Your AI provider, its saved key and model. */
interface AiKey {
  provider: AiProvider;
  key: string;
  model: string;
}

/** Your target score, and the facts an improve round may use. */
interface Goal {
  target: number;
  master: string;
  languages: string[];
  /** Your currency, for the cost the bell shows. */
  currency: ReturnType<typeof currencyFor>;
}

/** One job to write a kit for, with the kit settings of the saved search that queued it. */
export interface KitJob {
  jobId: string;
  title: string;
  company: string;
  target: number;
  /** The saved search that queued it, so it can show what its last run cost. */
  searchId?: number;
  /** Which parts Claude writes. All of them when not given. */
  parts?: KitParts;
  /** Use your master resume as it is when it already scores at least this. Null = never. */
  masterMin?: number | null;
  /**
   * Write it even when the job already has a saved kit (the Apply queue: a tailored resume alone
   * isn't a reply yet). Without it, a job with a kit is skipped.
   */
  overwrite?: boolean;
}

/** A job's kit prompt, worked out before the run so jobs that share its first part go together. */
interface Prepared {
  job: KitJob;
  fixed: string;
  text: string;
  /** Your master resume is used as it is; Claude writes only the other parts. */
  master: string | null;
  /** Claude writes nothing (only the master resume was wanted). */
  nothing: boolean;
}

export interface KitRunResult {
  written: number;
  failed: number;
  /** Kits written whose resume stayed below your target score (it would need skills you lack). */
  belowTarget: number;
}

/** Why a run stopped before the end, in words the bell can show. Null when it did not stop. */
type StopReason = 'NO_KEY' | 'KEY_REFUSED' | 'NO_RESUME' | null;

/** Where a user's latest run is, so the saved search can show it while it writes and when it is done. */
export interface KitRunStatus {
  running: boolean;
  /** Kits this run tries to write. */
  total: number;
  /** Jobs it has finished (written or failed). */
  done: number;
  written: number;
  failed: number;
  /** Why it stopped early or wrote none: NO_KEY, KEY_REFUSED, NO_RESUME, NONE_WRITTEN. */
  reason: string | null;
  startedAt: Date;
  /** The job whose kit is being written now. */
  jobId: string | null;
  /** Kits that used your master resume as it is. */
  usedMaster: number;
  /** Kits whose resume stayed below your target score. */
  belowTarget: number;
  /** What the run cost so far, in cents of `currency`. Null when the model's price is unknown. */
  costCents: number | null;
  currency: string;
  /** How much the cache saved, in percent of what it would have cost. */
  savedPercent: number;
}

/**
 * Apply kits: right after a saved search runs, its Autopilot (when "Write apply kits" is on)
 * hands over the jobs it queued, and this writes each one's kit (resume, cover letter, form
 * answers) with the user's own Claude or OpenAI key. It saves each reply as if pasted in the
 * job's Apply tab, so the German level cap and the usual checks apply. It never applies anywhere.
 */
@Injectable()
export class NightlyKitsService {
  private readonly logger = new Logger(NightlyKitsService.name);
  /** Users whose kits are being written now, so two runs never overlap. */
  private readonly running = new Set<number>();
  /** Jobs handed over while a run was going: that run writes them next. */
  private readonly pending = new Map<number, KitJob[]>();
  /** Each user's latest run since the server started. */
  private readonly runs = new Map<number, KitRunStatus>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
    private readonly apiKeys: ApiKeysService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Writes the kits of these jobs (the ones without a kit yet) and tells the user in the bell.
   * When a run is already going for this user, the jobs join it and this returns null at once.
   * Never throws.
   */
  async writeFor(userId: number, jobs: KitJob[]): Promise<KitRunResult | null> {
    const waiting = this.pending.get(userId) ?? [];
    for (const job of jobs) {
      if (!waiting.some((w) => w.jobId === job.jobId)) waiting.push(job);
    }
    this.pending.set(userId, waiting);
    if (this.running.has(userId)) {
      this.track(userId, { total: (this.runs.get(userId)?.total ?? 0) + jobs.length });
      return null;
    }
    this.running.add(userId);
    this.runs.set(userId, { ...this.fresh(), total: waiting.length });
    const sum: KitRunResult = { written: 0, failed: 0, belowTarget: 0 };
    let wrote = false;
    try {
      // Jobs handed over while writing are written in the same run.
      for (let next = this.take(userId); next.length > 0; next = this.take(userId)) {
        const result = await this.write(userId, next);
        if (!result) continue;
        wrote = true;
        sum.written += result.written;
        sum.failed += result.failed;
        sum.belowTarget += result.belowTarget;
      }
      return wrote ? sum : null;
    } catch (error) {
      this.logger.warn(`Apply kits for user ${String(userId)} failed: ${getErrorMessage(error)}`);
      this.pending.delete(userId);
      // Never silent: the bell and the saved search say it did not work.
      this.track(userId, { reason: 'NONE_WRITTEN' });
      await this.failed(userId, 'NONE_WRITTEN').catch(() => undefined);
      return null;
    } finally {
      this.running.delete(userId);
      this.track(userId, { running: false });
    }
  }

  private take(userId: number): KitJob[] {
    const jobs = this.pending.get(userId) ?? [];
    this.pending.delete(userId);
    return jobs;
  }

  /** Your latest run (this one or the last finished), or null when there was none. */
  status(userId: number): KitRunStatus | null {
    return this.runs.get(userId) ?? null;
  }

  private fresh(): KitRunStatus {
    return {
      running: true,
      total: 0,
      done: 0,
      written: 0,
      failed: 0,
      reason: null,
      startedAt: new Date(),
      jobId: null,
      usedMaster: 0,
      belowTarget: 0,
      costCents: null,
      currency: 'EUR',
      savedPercent: 0,
    };
  }

  private track(userId: number, change: Partial<KitRunStatus>): void {
    const now = this.runs.get(userId) ?? this.fresh();
    this.runs.set(userId, { ...now, ...change });
  }

  /** Writes one batch of kits and tells the user in the bell. Null when there was nothing to do. */
  private async write(userId: number, jobs: KitJob[]): Promise<KitRunResult | null> {
    const done = await this.prisma.jobResume.findMany({
      where: { userId, jobId: { in: jobs.map((job) => job.jobId) } },
      select: { jobId: true },
    });
    const hasKit = new Set(
      done.map((row) => row.jobId).filter((id) => !jobs.find((j) => j.jobId === id)?.overwrite),
    );
    const waiting = jobs.filter((job) => !hasKit.has(job.jobId));
    // Jobs that already have a kit don't count towards "kit N of M".
    const run = this.runs.get(userId);
    if (run) this.track(userId, { total: Math.max(run.done, run.total - hasKit.size) });
    if (waiting.length === 0) return null;
    const key = await this.keyFor(userId);
    if (!key) {
      this.track(userId, { reason: 'NO_KEY' });
      await this.failed(userId, 'NO_KEY');
      return null;
    }

    const facts = await this.factsFor(userId);
    const prepared = await this.prepare(userId, waiting);
    if (prepared.some((p) => p.text.includes(NO_RESUME) || p.fixed.includes(NO_RESUME))) {
      this.track(userId, { reason: 'NO_RESUME' });
      await this.failed(userId, 'NO_RESUME');
      return { written: 0, failed: 0, belowTarget: 0 };
    }
    // Kits whose first part is the same go one after the other, so Claude's cache (kept about 5
    // minutes) is still there for the next one. A first part used by one kit only isn't cached:
    // keeping it costs a quarter more and nothing reads it again.
    const shared = new Map<string, number>();
    for (const p of prepared) shared.set(p.fixed, (shared.get(p.fixed) ?? 0) + 1);
    prepared.sort((a, b) => (a.fixed < b.fixed ? -1 : a.fixed > b.fixed ? 1 : 0));

    const written: KitJob[] = [];
    let failed = 0;
    let belowTarget = 0;
    let usedMaster = 0;
    let stop: StopReason = null;
    const spent: { searchId: number | undefined; cost: KitCost | null }[] = [];
    const before = this.runs.get(userId);
    const doneBefore = before?.done ?? 0;
    for (const item of prepared) {
      const { job } = item;
      const goal: Goal = { ...facts, target: job.target };
      this.track(userId, { jobId: job.jobId });
      try {
        const cache = key.provider === AiProvider.ANTHROPIC && (shared.get(item.fixed) ?? 0) > 1;
        const { score, cost } = await this.writeOne(userId, item, key, goal, cache);
        if (score !== null && score < goal.target && !item.master) belowTarget += 1;
        if (item.master) usedMaster += 1;
        spent.push({ searchId: job.searchId, cost });
        written.push(job);
        const sofar = summedCost(spent.map((s) => s.cost));
        this.track(userId, {
          done: doneBefore + written.length + failed,
          written: (before?.written ?? 0) + written.length,
          usedMaster: (before?.usedMaster ?? 0) + usedMaster,
          belowTarget: (before?.belowTarget ?? 0) + belowTarget,
          currency: facts.currency,
          ...(sofar
            ? {
                costCents: (before?.costCents ?? 0) + centsIn(sofar.costMicroUsd, facts.currency),
                savedPercent: savedPercent(sofar),
              }
            : {}),
        });
      } catch (error) {
        if (error instanceof AiCallError && error.cause === 'KEY_REFUSED') {
          stop = 'KEY_REFUSED';
          break;
        }
        failed += 1;
        this.track(userId, {
          done: doneBefore + written.length + failed,
          failed: (before?.failed ?? 0) + failed,
        });
        this.logger.warn(
          `Kit for ${String(userId)}:${job.jobId} failed: ${getErrorMessage(error)}`,
        );
      }
    }

    this.track(userId, {
      jobId: null,
      reason: written.length === 0 ? (stop ?? 'NONE_WRITTEN') : stop,
    });
    await this.saveLastRuns(spent);
    if (written.length === 0) {
      await this.failed(userId, stop ?? 'NONE_WRITTEN', failed);
    } else {
      const fits = await this.prisma.jobFit.findMany({
        where: { userId, jobId: { in: written.map((job) => job.jobId) } },
        select: { jobId: true, score: true },
      });
      const fitOf = new Map(fits.map((row) => [row.jobId, row.score]));
      const money = summedCost(spent.map((s) => s.cost));
      await this.notifications.push(userId, KITS_READY, {
        searchName: '',
        count: written.length,
        fitMin: 0,
        jobs: written.slice(0, TOP_JOBS).map((job) => ({
          id: job.jobId,
          title: job.title,
          company: job.company,
          fit: fitOf.get(job.jobId) ?? 0,
        })),
        failed,
        belowTarget,
        target: Math.max(...written.map((job) => job.target)),
        usedMaster,
        ...(money
          ? {
              costCents: centsIn(money.costMicroUsd, facts.currency),
              savedPercent: savedPercent(money),
              currency: facts.currency,
            }
          : {}),
        ...(stop ? { reason: stop } : {}),
      });
    }
    return { written: written.length, failed, belowTarget };
  }

  /**
   * Works out each job's kit prompt, and whether your master resume can be used as it is: when
   * the search says so and it already scores at least the search's "use master resume" score, or
   * when the search doesn't write resumes at all.
   */
  private async prepare(userId: number, jobs: KitJob[]): Promise<Prepared[]> {
    const out: Prepared[] = [];
    for (const job of jobs) {
      const wanted = job.parts ?? ALL_KIT_PARTS;
      const first = await this.insights.kitPrompt(userId, job.jobId, wanted);
      const fits =
        job.masterMin != null && first.masterScore !== null && first.masterScore >= job.masterMin;
      const useMaster = wanted.resume ? fits : true;
      const parts: KitParts = { ...wanted, resume: !useMaster };
      const prompt = useMaster ? await this.insights.kitPrompt(userId, job.jobId, parts) : first;
      out.push({
        job,
        fixed: prompt.fixed,
        text: prompt.job,
        master: useMaster ? first.master : null,
        nothing: useMaster && !parts.cover && !parts.answers,
      });
    }
    return out;
  }

  /** Each saved search shows what its latest kits run cost. */
  private async saveLastRuns(
    spent: { searchId: number | undefined; cost: KitCost | null }[],
  ): Promise<void> {
    const bySearch = new Map<number, (KitCost | null)[]>();
    for (const { searchId, cost } of spent) {
      if (searchId === undefined) continue;
      bySearch.set(searchId, [...(bySearch.get(searchId) ?? []), cost]);
    }
    for (const [id, costs] of bySearch) {
      const money = summedCost(costs);
      await this.prisma.savedSearch
        .update({
          where: { id },
          data: {
            lastKitRun: {
              at: new Date().toISOString(),
              kits: costs.length,
              costMicroUsd: money?.costMicroUsd ?? null,
              savedMicroUsd: money?.savedMicroUsd ?? null,
            },
          },
        })
        .catch(() => undefined);
    }
  }

  /** The facts an improve round may use: your master resume and languages. */
  private async factsFor(userId: number): Promise<Omit<Goal, 'target'>> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { resumeText: true, languages: true, address: true },
    });
    return {
      master: profile?.resumeText ?? '',
      languages: profile?.languages ?? [],
      currency: currencyFor(profile?.address ?? ''),
    };
  }

  /**
   * Writes one job's kit, then improves its resume while it scores below your target: at most
   * MAX_IMPROVE_ROUNDS more calls, each only adding terms you really have. A round that scores
   * lower is undone. With your master resume used as it is, Claude writes only the other parts and
   * there is no improve round. Returns the kit's final score and what it cost.
   */
  private async writeOne(
    userId: number,
    item: Prepared,
    key: AiKey,
    goal: Goal,
    cache: boolean,
  ): Promise<{ score: number | null; cost: KitCost | null }> {
    const { job } = item;
    const calls: AiUsage[] = [];
    let reply = '';
    if (!item.nothing) {
      const answer = await completeWithUsage(
        key.provider,
        key.key,
        key.model,
        { start: item.fixed, job: item.text, cache },
        { maxTokens: KIT_MAX_TOKENS, timeoutMs: KIT_TIMEOUT_MS },
      );
      calls.push(answer.usage);
      reply = answer.text;
    }
    // Your master resume goes in as the kit's resume, so the kit is complete and scored.
    if (item.master !== null) reply = `=== RESUME ===\n${item.master}\n${reply}`;
    let insights = await this.insights.saveJobResume(userId, job.jobId, reply);
    try {
      for (let round = 0; item.master === null && round < MAX_IMPROVE_ROUNDS; round += 1) {
        const kit = insights.jobResume;
        if (!kit || kit.score === null || kit.score >= goal.target) break;
        const terms = honestMissing([...insights.skills, ...insights.keywords], kit.stillMissing);
        // Nothing left that you really have: this is the best honest score.
        if (terms.length === 0) break;
        const better = await completeWithUsage(
          key.provider,
          key.key,
          key.model,
          buildImprovePrompt({
            title: job.title,
            company: job.company,
            resume: kit.text,
            score: kit.score,
            target: goal.target,
            terms,
            master: goal.master,
            languages: goal.languages,
          }),
          { maxTokens: IMPROVE_MAX_TOKENS, timeoutMs: KIT_TIMEOUT_MS },
        );
        calls.push(better.usage);
        const next = await this.insights.saveJobResume(userId, job.jobId, better.text);
        if ((next.jobResume?.score ?? 0) < kit.score) {
          // Worse than before: keep the earlier resume and stop.
          insights = await this.insights.saveJobResume(userId, job.jobId, kit.text);
          break;
        }
        insights = next;
      }
    } catch (error) {
      // The kit is written; only the extra round failed. Its score is what it is.
      this.logger.warn(
        `Improving the kit for ${String(userId)}:${job.jobId} failed: ${getErrorMessage(error)}`,
      );
    }
    const cost = costOf(key.model, calls);
    await this.prisma.jobResume.updateMany({
      where: { userId, jobId: job.jobId },
      data: {
        usedMaster: item.master !== null,
        costMicroUsd: cost?.costMicroUsd ?? null,
        savedMicroUsd: cost?.savedMicroUsd ?? null,
      },
    });
    return { score: insights.jobResume?.score ?? null, cost };
  }

  /** The user's chosen AI provider with its saved key and model, or null without a key. */
  private async keyFor(userId: number): Promise<AiKey | null> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { aiProvider: true },
    });
    const provider = AI_PROVIDERS[user.aiProvider];
    const saved = await this.apiKeys.aiKey(userId, provider.kind);
    if (!saved) return null;
    return {
      provider: user.aiProvider,
      key: saved.key,
      model: saved.model ?? provider.defaultModel,
    };
  }

  private async failed(userId: number, reason: string, failed = 0): Promise<void> {
    await this.notifications.push(userId, KITS_FAILED, {
      searchName: '',
      count: 0,
      fitMin: 0,
      jobs: [],
      failed,
      reason,
    });
  }
}
