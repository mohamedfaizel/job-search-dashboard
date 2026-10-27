import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { ApplicationStatus, JobSource } from '../generated/prisma/enums';
import type { MappedJob } from '../jobspipe/jobspipe.mapper';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateJobInput } from './dto/create-job.input';
import type { JobFilterInput, JobsArgs, JobSortInput } from './dto/jobs.args';
import { JobSortField } from './models/enums';
import type { JobFilterOptions, JobPage } from './models/job.model';

/** Loads the company and this user's application, so `applicationStatus` is theirs. */
function forUser(userId: number) {
  return {
    company: true,
    applications: { where: { userId }, select: { status: true } },
  } satisfies Prisma.JobInclude;
}
type JobForUser = Prisma.JobGetPayload<{ include: ReturnType<typeof forUser> }>;

/** The job as one user sees it: no application row means they haven't acted on it. */
function withStatus({ applications, ...job }: JobForUser) {
  return { ...job, applicationStatus: applications[0]?.status ?? ApplicationStatus.NONE };
}

export interface UpsertResult {
  created: number;
  updated: number;
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  /** One page of jobs as `userId` sees them: their hidden jobs are left out, or only those. */
  async findPage(userId: number, { filter, sort, page, pageSize }: JobsArgs): Promise<JobPage> {
    const hiddenByMe = { hiddenBy: { some: { userId } } } satisfies Prisma.JobWhereInput;
    const where: Prisma.JobWhereInput = {
      AND: [buildWhere(filter, userId), filter?.hidden ? hiddenByMe : { NOT: hiddenByMe }],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        orderBy: buildOrderBy(sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: forUser(userId),
      }),
      this.prisma.job.count({ where }),
    ]);
    return { items: items.map(withStatus), total, page, pageSize };
  }

  async findOne(userId: number, id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, include: forUser(userId) });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return withStatus(job);
  }

  /** The jobs this user is tracking (any status but NONE), most recently moved first. */
  async applications(userId: number) {
    const rows = await this.prisma.application.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { jobId: 'asc' }],
      include: { job: { include: forUser(userId) } },
    });
    return rows.map(({ status, updatedAt, job }) => ({ status, updatedAt, job: withStatus(job) }));
  }

  async filterOptions(): Promise<JobFilterOptions> {
    const distinct = async (
      field: 'seniority' | 'jobFunction' | 'city' | 'countryCode' | 'provider' | 'industry',
    ) => {
      const rows = await this.prisma.job.findMany({
        where: { [field]: { not: null } },
        distinct: [field],
        select: { [field]: true },
        orderBy: { [field]: 'asc' },
      });
      return (
        rows
          // The computed `select` key hides the row type from TypeScript, so name it here.
          .map((row) => (row as unknown as Record<string, string | null>)[field])
          .filter((v): v is string => !!v)
      );
    };

    const [
      companies,
      skills,
      seniorities,
      jobFunctions,
      cities,
      countryCodes,
      providers,
      industries,
    ] = await Promise.all([
      this.prisma.company.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      this.prisma.$queryRaw<{ skill: string }[]>`
          SELECT DISTINCT unnest(skills) AS skill FROM "Job" ORDER BY skill`,
      distinct('seniority'),
      distinct('jobFunction'),
      distinct('city'),
      distinct('countryCode'),
      distinct('provider'),
      distinct('industry'),
    ]);

    return {
      companies: companies.map((c) => c.name),
      skills: skills.map((s) => s.skill),
      seniorities,
      jobFunctions,
      cities,
      countryCodes,
      providers,
      industries,
    };
  }

  /** Adds a job by hand. A status in the input becomes the creator's own application. */
  async create(userId: number, input: CreateJobInput) {
    const { companyName, salaryMinUsd, salaryMaxUsd, applicationStatus, ...rest } = input;
    if (salaryMinUsd !== undefined && salaryMaxUsd !== undefined && salaryMinUsd > salaryMaxUsd) {
      throw new BadRequestException('salaryMinUsd cannot be greater than salaryMaxUsd');
    }

    const job = await this.prisma.job.create({
      data: {
        ...rest,
        countryCode: rest.countryCode?.toUpperCase() ?? null,
        salaryMinUsd: salaryMinUsd ?? null,
        salaryMaxUsd: salaryMaxUsd ?? null,
        source: JobSource.MANUAL,
        postedAt: rest.postedAt ?? new Date(),
        company: {
          connectOrCreate: {
            where: { name: companyName.trim() },
            create: { name: companyName.trim() },
          },
        },
        ...(applicationStatus && applicationStatus !== ApplicationStatus.NONE
          ? { applications: { create: { userId, status: applicationStatus } } }
          : {}),
      },
      include: forUser(userId),
    });
    return withStatus(job);
  }

  /** Hides a job from one user's table. Hiding it again does nothing. */
  async hide(userId: number, jobId: string): Promise<boolean> {
    await this.findOne(userId, jobId);
    await this.prisma.hiddenJob.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId },
      update: {},
    });
    return true;
  }

  async unhide(userId: number, jobId: string): Promise<boolean> {
    await this.prisma.hiddenJob.deleteMany({ where: { userId, jobId } });
    return true;
  }

  hiddenCount(userId: number): Promise<number> {
    return this.prisma.hiddenJob.count({ where: { userId } });
  }

  /** Moves one user's application for a job. NONE removes it from their tracker. */
  async updateApplicationStatus(userId: number, jobId: string, status: ApplicationStatus) {
    await this.findOne(userId, jobId); // gives a clean "not found" error instead of a Prisma one
    if (status === ApplicationStatus.NONE) {
      await this.prisma.application.deleteMany({ where: { userId, jobId } });
    } else {
      await this.prisma.application.upsert({
        where: { userId_jobId: { userId, jobId } },
        create: { userId, jobId, status },
        update: { status },
      });
    }
    return this.findOne(userId, jobId);
  }

  /**
   * Saves JobsPipe postings. Re-running with the same postings updates them in place
   * (matched on externalId). Application statuses live in their own table, so they stay.
   */
  async upsertMany(mapped: MappedJob[]): Promise<UpsertResult> {
    if (mapped.length === 0) return { created: 0, updated: 0 };

    const existing = await this.prisma.job.findMany({
      where: { externalId: { in: mapped.map((m) => m.job.externalId) } },
      select: { externalId: true },
    });
    const existingIds = new Set(existing.map((e) => e.externalId));

    // One company row per name; keep any domain/logo we already have.
    const companyIds = new Map<string, number>();
    for (const { company } of mapped) {
      if (companyIds.has(company.name)) continue;
      const row = await this.prisma.company.upsert({
        where: { name: company.name },
        create: company,
        update: {
          ...(company.domain ? { domain: company.domain } : {}),
          ...(company.logoUrl ? { logoUrl: company.logoUrl } : {}),
        },
        select: { id: true },
      });
      companyIds.set(company.name, row.id);
    }

    await this.prisma.$transaction(
      mapped.map(({ company, job }) => {
        const data = { ...job, companyId: companyIds.get(company.name) ?? 0 };
        return this.prisma.job.upsert({
          where: { externalId: job.externalId },
          create: data,
          update: data,
        });
      }),
    );

    const created = mapped.filter((m) => !existingIds.has(m.job.externalId)).length;
    return { created, updated: mapped.length - created };
  }
}

function buildWhere(filter: JobFilterInput | undefined, userId: number): Prisma.JobWhereInput {
  if (!filter) return {};
  const and: Prisma.JobWhereInput[] = [];
  const inList = <T>(values: T[] | undefined) => (values?.length ? { in: values } : null);

  const search = filter.search?.trim();
  if (search) {
    and.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }
  const companies = inList(filter.companies);
  if (companies) and.push({ company: { name: companies } });
  if (filter.skills?.length) and.push({ skills: { hasSome: filter.skills } });
  if (filter.minSalaryUsd !== undefined) and.push({ salaryMaxUsd: { gte: filter.minSalaryUsd } });
  if (filter.postedAfter) and.push({ postedAt: { gte: filter.postedAfter } });

  const lists = {
    seniority: inList(filter.seniorities),
    jobFunction: inList(filter.jobFunctions),
    city: inList(filter.cities),
    countryCode: inList(filter.countryCodes),
    provider: inList(filter.providers),
    industry: inList(filter.industries),
    workplace: inList(filter.workplaces),
    source: inList(filter.sources),
  };
  for (const [field, condition] of Object.entries(lists)) {
    if (condition) and.push({ [field]: condition });
  }

  const statuses = filter.applicationStatuses ?? [];
  if (statuses.length) {
    // NONE is stored as "no row", so it needs its own condition.
    const stored = statuses.filter((status) => status !== ApplicationStatus.NONE);
    const or: Prisma.JobWhereInput[] = [];
    if (stored.length) or.push({ applications: { some: { userId, status: { in: stored } } } });
    if (stored.length < statuses.length) or.push({ applications: { none: { userId } } });
    and.push({ OR: or });
  }

  return and.length ? { AND: and } : {};
}

function buildOrderBy(sort: JobSortInput | undefined): Prisma.JobOrderByWithRelationInput[] {
  // Always end with id so pages are stable when the sorted values tie.
  const tieBreaker: Prisma.JobOrderByWithRelationInput = { id: 'asc' };
  if (!sort) return [{ postedAt: 'desc' }, tieBreaker];

  const dir = sort.direction;
  const nullsLast = { sort: dir, nulls: 'last' } as const;
  const bySort: Record<JobSortField, Prisma.JobOrderByWithRelationInput[]> = {
    [JobSortField.POSTED_AT]: [{ postedAt: dir }],
    [JobSortField.TITLE]: [{ title: dir }],
    [JobSortField.COMPANY]: [{ company: { name: dir } }],
    [JobSortField.SENIORITY]: [{ seniority: nullsLast }],
    [JobSortField.CITY]: [{ city: nullsLast }],
    [JobSortField.SALARY]: [{ salaryMaxUsd: nullsLast }, { salaryMinUsd: nullsLast }],
    [JobSortField.WORKPLACE]: [{ workplace: nullsLast }],
  };
  return [...bySort[sort.field], tieBreaker];
}
