import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ApplicationStatus, Prisma } from '../generated/prisma/client';
import { JobSource } from '../generated/prisma/enums';
import type { MappedJob } from '../jobspipe/jobspipe.mapper';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateJobInput } from './dto/create-job.input';
import type { JobFilterInput, JobsArgs, JobSortInput } from './dto/jobs.args';
import { JobSortField } from './models/enums';
import type { JobFilterOptions, JobPage } from './models/job.model';

const withCompany = { company: true } satisfies Prisma.JobInclude;

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
      AND: [buildWhere(filter), filter?.hidden ? hiddenByMe : { NOT: hiddenByMe }],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        orderBy: buildOrderBy(sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: withCompany,
      }),
      this.prisma.job.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, include: withCompany });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
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

  async create(input: CreateJobInput) {
    const { companyName, salaryMinUsd, salaryMaxUsd, ...rest } = input;
    if (salaryMinUsd !== undefined && salaryMaxUsd !== undefined && salaryMinUsd > salaryMaxUsd) {
      throw new BadRequestException('salaryMinUsd cannot be greater than salaryMaxUsd');
    }

    return this.prisma.job.create({
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
      },
      include: withCompany,
    });
  }

  /** Hides a job from one user's table. Hiding it again does nothing. */
  async hide(userId: number, jobId: string): Promise<boolean> {
    await this.findOne(jobId);
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

  async updateApplicationStatus(id: string, status: ApplicationStatus) {
    await this.findOne(id); // gives a clean "not found" error instead of a Prisma one
    return this.prisma.job.update({
      where: { id },
      data: { applicationStatus: status },
      include: withCompany,
    });
  }

  /**
   * Saves JobsPipe postings. Re-running with the same postings updates them in place
   * (matched on externalId) and never touches your applicationStatus.
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

function buildWhere(filter: JobFilterInput | undefined): Prisma.JobWhereInput {
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
    applicationStatus: inList(filter.applicationStatuses),
  };
  for (const [field, condition] of Object.entries(lists)) {
    if (condition) and.push({ [field]: condition });
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
    [JobSortField.APPLICATION_STATUS]: [{ applicationStatus: dir }],
  };
  return [...bySort[sort.field], tieBreaker];
}
