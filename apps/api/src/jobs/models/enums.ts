import { registerEnumType } from '@nestjs/graphql';
import {
  ApplicationStatus,
  JobMatchStatus,
  JobSource,
  VisaSponsorship,
  Workplace,
} from '../../generated/prisma/enums';

// Reuse Prisma's enums in the GraphQL schema so the database and API never drift apart.
registerEnumType(ApplicationStatus, { name: 'ApplicationStatus' });
registerEnumType(JobMatchStatus, { name: 'JobMatchStatus' });
registerEnumType(JobSource, { name: 'JobSource' });
registerEnumType(Workplace, { name: 'Workplace' });
registerEnumType(VisaSponsorship, { name: 'VisaSponsorship' });

export enum JobSortField {
  POSTED_AT = 'postedAt',
  TITLE = 'title',
  COMPANY = 'company',
  SENIORITY = 'seniority',
  CITY = 'city',
  SALARY = 'salary',
  WORKPLACE = 'workplace',
  /** Your Fit %: best first when descending. Jobs without a score go last either way. */
  FIT = 'fit',
}
registerEnumType(JobSortField, { name: 'JobSortField' });

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}
registerEnumType(SortDirection, { name: 'SortDirection' });

export { ApplicationStatus, JobMatchStatus, JobSource, VisaSponsorship, Workplace };
