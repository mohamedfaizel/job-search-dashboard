import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { InsightsService } from '../insights/insights.service';
import { NightlyKitsService } from './nightly-kits.service';

@ObjectType('KitRun', { description: 'Your latest apply-kits run, while it writes and after' })
export class KitRunModel {
  @Field({ description: 'Still writing' })
  running!: boolean;

  @Field(() => Int, { description: 'Kits this run tries to write' })
  total!: number;

  @Field(() => Int, { description: 'Jobs finished so far (written or failed)' })
  done!: number;

  @Field(() => Int)
  written!: number;

  @Field(() => Int)
  failed!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Why it stopped early or wrote none: NO_KEY, KEY_REFUSED, NO_RESUME, NONE_WRITTEN',
  })
  reason!: string | null;

  @Field()
  startedAt!: Date;

  @Field(() => ID, { nullable: true, description: 'The job whose kit is being written now' })
  jobId!: string | null;

  @Field(() => Int, { description: 'Kits that used your master resume as it is' })
  usedMaster!: number;

  @Field(() => Int, { description: 'Kits whose resume stayed below your target score' })
  belowTarget!: number;

  @Field(() => Int, {
    nullable: true,
    description: 'What the run cost, in cents of currency. Null when the price is unknown',
  })
  costCents!: number | null;

  @Field({ description: 'EUR, GBP or USD, from your profile address' })
  currency!: string;

  @Field(() => Int, { description: 'How much the cache saved, in percent' })
  savedPercent!: number;
}

/** The score every Apply-queue kit aims for, as a saved search's Autopilot does by default. */
export const QUEUE_KIT_TARGET = 90;

@InputType('QueueKitsInput', { description: 'How "Write with my key" writes the queued kits' })
export class QueueKitsInput {
  @Field({ defaultValue: true })
  @IsBoolean()
  resume!: boolean;

  @Field({ defaultValue: true })
  @IsBoolean()
  cover!: boolean;

  @Field({ defaultValue: true })
  @IsBoolean()
  answers!: boolean;

  @Field(() => Int, {
    nullable: true,
    description: 'Use your master resume as it is when it already scores at least this',
  })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  masterMin?: number | null;
}

@Resolver()
export class NightlyKitsResolver {
  constructor(
    private readonly service: NightlyKitsService,
    private readonly insights: InsightsService,
  ) {}

  @Query(() => KitRunModel, {
    nullable: true,
    description:
      'Your latest apply-kits run, so your saved searches can show its progress and result',
  })
  kitRun(@CurrentUser() user: SessionUser): KitRunModel | null {
    return this.service.status(user.id);
  }

  @Mutation(() => KitRunModel, {
    description:
      'Writes the kits of your queued jobs that have no reply yet, with your own AI key. It runs on ' +
      'the server; ask kitRun for its progress. Joins a run that is already going.',
  })
  async writeApplyQueueKits(
    @CurrentUser() user: SessionUser,
    @Args('input', { type: () => QueueKitsInput }) input: QueueKitsInput,
  ): Promise<KitRunModel> {
    const waiting = (await this.insights.applyQueue(user.id)).filter((item) => !item.ready);
    const parts = { resume: input.resume, cover: input.cover, answers: input.answers };
    if (!parts.resume && !parts.cover && !parts.answers) parts.cover = parts.answers = true;
    // Not awaited: writing takes about a minute a kit. Its run status is set before this returns.
    if (waiting.length > 0) {
      void this.service.writeFor(
        user.id,
        waiting.map((item) => ({
          jobId: item.jobId,
          title: item.title,
          company: item.company,
          target: QUEUE_KIT_TARGET,
          parts,
          masterMin: input.masterMin ?? null,
          overwrite: true,
        })),
      );
    }
    return (
      this.service.status(user.id) ?? {
        running: false,
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
      }
    );
  }
}
