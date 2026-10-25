// Columns from the reference design. Step 3 turns these into a sortable, filterable table.
export const JOB_COLUMNS = [
  'Company',
  'Posted',
  'Job title',
  'Function',
  'Seniority',
  'Skills',
  'City',
  'Salary',
  'Source',
  'Workplace',
  'Industry',
] as const;

export type JobColumn = (typeof JOB_COLUMNS)[number];
