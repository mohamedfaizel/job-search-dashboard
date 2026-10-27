import { registerEnumType } from '@nestjs/graphql';
import {
  ApplicationStatus,
  JobMatchStatus,
  JobSource,
  Workplace,
} from '../../generated/prisma/enums';

// Reuse Prisma's enums in the GraphQL schema so the database and API never drift apart.
registerEnumType(ApplicationStatus, { name: 'ApplicationStatus' });
registerEnumType(JobMatchStatus, { name: 'JobMatchStatus' });
registerEnumType(JobSource, { name: 'JobSource' });
registerEnumType(Workplace, { name: 'Workplace' });

export enum JobSortField {
  POSTED_AT = 'postedAt',
  TITLE = 'title',
  COMPANY = 'company',
  SENIORITY = 'seniority',
  CITY = 'city',
  SALARY = 'salary',
  WORKPLACE = 'workplace',
}
registerEnumType(JobSortField, { name: 'JobSortField' });

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}
registerEnumType(SortDirection, { name: 'SortDirection' });

export { ApplicationStatus, JobMatchStatus, JobSource, Workplace };
