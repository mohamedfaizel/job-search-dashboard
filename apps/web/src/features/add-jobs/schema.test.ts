import {
  defaultSyncForm,
  emptyJobForm,
  jobFormSchema,
  savedSearchToForm,
  syncFormSchema,
  toCreateJobInput,
  toSyncJobsInput,
} from './schema';
import { SAVED } from './test/server';

/** Error messages as their keys, so tests don't depend on the wording. */
const KEY = (key: string) => key;

describe('jobFormSchema', () => {
  const valid = { ...emptyJobForm, title: 'Dev', companyName: 'Acme' };

  it('needs a title and a company', () => {
    const result = jobFormSchema(KEY).safeParse(emptyJobForm);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(['title', 'companyName']);
  });

  it('rejects a minimum salary above the maximum', () => {
    const result = jobFormSchema(KEY).safeParse({
      ...valid,
      salaryMinUsd: '200000',
      salaryMaxUsd: '100000',
    });
    expect(result.error?.issues[0]?.path).toEqual(['salaryMaxUsd']);
  });

  it('rejects bad links and country codes', () => {
    const result = jobFormSchema(KEY).safeParse({
      ...valid,
      url: 'example.com',
      countryCode: 'USA',
    });
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
        ...defaultSyncForm,
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

  it('adds only the extra filters that are set', () => {
    expect(
      toSyncJobsInput({
        ...defaultSyncForm,
        languages: ['en'],
        skipFluentGerman: true,
        excludeTitles: 'Werkstudent, , Praktikum',
        employmentTypes: ['full-time'],
        minSalaryEur: ' 60000 ',
      }),
    ).toMatchObject({
      languages: ['en'],
      skipFluentGerman: true,
      excludeTitles: ['Werkstudent', 'Praktikum'],
      employmentTypes: ['full-time'],
      minSalaryEur: 60000,
    });
    const plain = toSyncJobsInput(defaultSyncForm);
    for (const key of [
      'languages',
      'skipFluentGerman',
      'remoteOnly',
      'excludeTitles',
      'minSalaryEur',
    ]) {
      expect(plain).not.toHaveProperty(key);
    }
  });

  it('turns a saved search with filters back into the form', () => {
    expect(
      savedSearchToForm({
        ...SAVED,
        remoteOnly: true,
        excludeTitles: ['Intern'],
        minSalaryEur: 50000,
      }),
    ).toMatchObject({ remoteOnly: true, excludeTitles: 'Intern', minSalaryEur: '50000' });
  });

  it('refuses a salary that is not a whole number', () => {
    const result = syncFormSchema(KEY).safeParse({ ...defaultSyncForm, minSalaryEur: '60k' });
    expect(result.success).toBe(false);
  });
});
