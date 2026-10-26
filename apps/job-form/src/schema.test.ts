import {
  emptyJobForm,
  jobFormSchema,
  splitList,
  toCreateJobInput,
  toSyncJobsInput,
} from './schema';

describe('splitList', () => {
  it('splits on commas and drops blanks', () => {
    expect(splitList(' react, node.js ,, ')).toEqual(['react', 'node.js']);
  });
});

describe('jobFormSchema', () => {
  const valid = { ...emptyJobForm, title: 'Dev', companyName: 'Acme' };

  it('needs a title and a company', () => {
    const result = jobFormSchema.safeParse(emptyJobForm);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(['title', 'companyName']);
  });

  it('rejects a minimum salary above the maximum', () => {
    const result = jobFormSchema.safeParse({
      ...valid,
      salaryMinUsd: '200000',
      salaryMaxUsd: '100000',
    });
    expect(result.error?.issues[0]?.path).toEqual(['salaryMaxUsd']);
  });

  it('rejects bad links and country codes', () => {
    const result = jobFormSchema.safeParse({ ...valid, url: 'example.com', countryCode: 'USA' });
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(['url', 'countryCode']);
  });
});

describe('toCreateJobInput', () => {
  it('converts form strings and leaves out empty fields', () => {
    expect(
      toCreateJobInput({
        ...emptyJobForm,
        title: ' Frontend Engineer ',
        companyName: 'Acme',
        countryCode: 'de',
        skills: 'react, typescript',
        salaryMinUsd: '90000',
        workplace: 'REMOTE',
      }),
    ).toEqual({
      title: 'Frontend Engineer',
      companyName: 'Acme',
      applicationStatus: 'SAVED',
      countryCode: 'DE',
      skills: ['react', 'typescript'],
      salaryMinUsd: 90000,
      workplace: 'REMOTE',
    });
  });
});

describe('toSyncJobsInput', () => {
  it('builds the sync input', () => {
    expect(
      toSyncJobsInput({
        titles: 'frontend, react developer',
        skills: '',
        countryCodes: 'de, us',
        locations: ' Berlin ,, Bavaria',
        maxAgeDays: '2',
        pageSize: '10',
        maxPages: '3',
        onlyNew: true,
      }),
    ).toEqual({
      titles: ['frontend', 'react developer'],
      countryCodes: ['DE', 'US'],
      locations: ['Berlin', 'Bavaria'],
      maxAgeDays: 2,
      pageSize: 10,
      maxPages: 3,
      onlyNew: true,
    });
  });
});
