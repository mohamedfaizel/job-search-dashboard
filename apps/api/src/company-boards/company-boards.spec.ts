import { describe, expect, it } from 'vitest';
import type { SyncJobsInput } from '../sync/sync.input';
import { employmentTypeOf, fromAshby, fromGreenhouse, fromLever } from './board-feeds';
import { boardKey, companyNameFromSlug, parseBoard } from './board-ref';
import { boardsOf, companyBoardsKey } from './company-boards-sync.service';
import { boardExternalId, fitsSearch, mapBoardPosting } from './company-boards.mapper';
import type { BoardPosting } from './company-boards.types';

describe('parseBoard', () => {
  it.each([
    ['greenhouse:stripe', { ats: 'greenhouse', slug: 'stripe' }],
    [' Lever : Netflix ', { ats: 'lever', slug: 'netflix' }],
    ['https://boards.greenhouse.io/Stripe/jobs/123', { ats: 'greenhouse', slug: 'stripe' }],
    ['job-boards.greenhouse.io/acme', { ats: 'greenhouse', slug: 'acme' }],
    ['https://jobs.lever.co/netflix?lever-via=x', { ats: 'lever', slug: 'netflix' }],
    ['https://jobs.ashbyhq.com/ramp', { ats: 'ashby', slug: 'ramp' }],
  ])('reads %s', (text, board) => {
    expect(parseBoard(text)).toEqual(board);
  });

  it.each([
    '',
    'stripe',
    'workday:stripe',
    'greenhouse:',
    'https://example.com/stripe',
    'lever:a b',
  ])('rejects %j', (text) => {
    expect(parseBoard(text)).toBeNull();
  });

  it('names a board and writes a company name from it', () => {
    expect(boardKey({ ats: 'ashby', slug: 'ramp' })).toBe('ashby:ramp');
    expect(companyNameFromSlug('my-company_inc')).toBe('My Company Inc');
  });
});

describe('feeds', () => {
  it('reads Greenhouse, whose description is escaped HTML', () => {
    const [job, ...rest] = fromGreenhouse({
      jobs: [
        {
          id: 42,
          title: 'Frontend Engineer',
          absolute_url: 'https://boards.greenhouse.io/acme/jobs/42',
          location: { name: 'Remote - Germany' },
          first_published: '2026-11-01T10:00:00Z',
          company_name: 'Acme',
          content:
            '&lt;p&gt;Build things with R&amp;amp;D&lt;/p&gt;&lt;ul&gt;&lt;li&gt;React&lt;/li&gt;&lt;/ul&gt;',
          departments: [{ name: 'Engineering' }],
        },
        { id: 43, title: 'No link' },
      ],
    });
    expect(rest).toEqual([]);
    expect(job).toMatchObject({
      id: '42',
      company: 'Acme',
      location: 'Remote - Germany',
      remote: true,
      department: 'Engineering',
      postedAt: new Date('2026-11-01T10:00:00Z'),
    });
    expect(job?.description).toContain('- React');
    expect(job?.description).not.toContain('<');
  });

  it('reads Lever, with its lists and work place', () => {
    const [job] = fromLever([
      {
        id: 'abc',
        text: 'Designer',
        hostedUrl: 'https://jobs.lever.co/x/abc',
        createdAt: Date.parse('2026-11-02T00:00:00Z'),
        workplaceType: 'hybrid',
        descriptionPlain: 'Design.',
        lists: [{ text: 'You have', content: '<li>Figma</li>' }],
        additionalPlain: 'We care.',
        categories: { location: 'Berlin', team: 'Design', commitment: 'Full-time' },
      },
      { id: 'no-title' },
    ]);
    expect(job).toMatchObject({
      remote: false,
      employmentType: 'full-time',
      department: 'Design',
      postedAt: new Date('2026-11-02T00:00:00Z'),
    });
    expect(job?.description).toBe('Design.\n\nYou have\n- Figma\n\nWe care.');
  });

  it('marks a Lever posting remote, and unknown when it does not say', () => {
    const base = { id: '1', text: 'A', hostedUrl: 'https://x' };
    expect(fromLever([{ ...base, workplaceType: 'remote' }])[0]?.remote).toBe(true);
    expect(fromLever([{ ...base, workplaceType: 'unspecified' }])[0]?.remote).toBeNull();
    expect(fromLever([{ ...base, categories: { location: 'Remote (EU)' } }])[0]?.remote).toBe(true);
  });

  it('reads Ashby and skips unlisted postings', () => {
    const jobs = fromAshby({
      jobs: [
        {
          id: 'a1',
          title: 'Backend',
          jobUrl: 'https://jobs.ashbyhq.com/ramp/a1',
          location: 'Berlin',
          employmentType: 'PartTime',
          isRemote: false,
          publishedAt: '2026-11-01T00:00:00Z',
          descriptionHtml: '<p>Go services</p>',
        },
        { id: 'a2', title: 'Hidden', jobUrl: 'https://x', isListed: false },
        {
          id: 'a3',
          title: 'Plain',
          jobUrl: 'https://x',
          descriptionPlain: 'Plain text',
          isRemote: true,
        },
      ],
    });
    expect(jobs.map((j) => j.id)).toEqual(['a1', 'a3']);
    expect(jobs[0]).toMatchObject({
      employmentType: 'part-time',
      remote: false,
      description: 'Go services',
    });
    expect(jobs[1]).toMatchObject({ remote: true, description: 'Plain text' });
  });

  it('reads job types', () => {
    expect(employmentTypeOf('FullTime')).toBe('full-time');
    expect(employmentTypeOf('Intern')).toBe('internship');
    expect(employmentTypeOf('Contract')).toBe('contract');
    expect(employmentTypeOf('Werkstudent')).toBe('internship');
    expect(employmentTypeOf('Mystery')).toBeNull();
    expect(employmentTypeOf(undefined)).toBeNull();
  });
});

const posting: BoardPosting = {
  id: '1',
  title: 'Senior Frontend Engineer',
  url: 'https://example.com/1',
  company: null,
  location: 'Berlin, Germany',
  remote: null,
  postedAt: new Date('2026-11-01T00:00:00Z'),
  employmentType: 'full-time',
  department: 'Engineering',
  description: 'Build the web app with React in our Berlin office.',
  raw: { id: '1' },
};
const NOW = new Date('2026-11-03T00:00:00Z');
const search = {
  titles: ['frontend'],
  maxAgeDays: 7,
};

describe('fitsSearch', () => {
  it('keeps a posting that fits', () => {
    expect(fitsSearch(posting, search, NOW)).toBe(true);
  });
  it('matches any title word, ignoring case, and keeps all when none is given', () => {
    expect(fitsSearch(posting, { ...search, titles: ['Designer', 'ENGINEER'] }, NOW)).toBe(true);
    expect(fitsSearch(posting, { ...search, titles: ['designer'] }, NOW)).toBe(false);
    expect(fitsSearch(posting, { ...search, titles: [] }, NOW)).toBe(true);
  });
  it('skips excluded titles', () => {
    expect(fitsSearch(posting, { ...search, excludeTitles: ['senior'] }, NOW)).toBe(false);
  });
  it('filters by place', () => {
    expect(fitsSearch(posting, { ...search, locations: ['berlin'] }, NOW)).toBe(true);
    expect(fitsSearch(posting, { ...search, locations: ['Munich'] }, NOW)).toBe(false);
    expect(
      fitsSearch({ ...posting, location: null }, { ...search, locations: ['Berlin'] }, NOW),
    ).toBe(false);
  });
  it('needs a posting that says remote when asked for remote', () => {
    expect(fitsSearch(posting, { ...search, remoteOnly: true }, NOW)).toBe(false);
    expect(fitsSearch({ ...posting, remote: true }, { ...search, remoteOnly: true }, NOW)).toBe(
      true,
    );
  });
  it('filters by job type, but keeps a posting with no type', () => {
    expect(fitsSearch(posting, { ...search, employmentTypes: ['part-time'] }, NOW)).toBe(false);
    expect(fitsSearch(posting, { ...search, employmentTypes: ['full-time'] }, NOW)).toBe(true);
    expect(
      fitsSearch(
        { ...posting, employmentType: null },
        { ...search, employmentTypes: ['part-time'] },
        NOW,
      ),
    ).toBe(true);
  });
  it('drops old postings, but keeps one with no date', () => {
    expect(fitsSearch(posting, { ...search, maxAgeDays: 1 }, NOW)).toBe(false);
    expect(fitsSearch({ ...posting, postedAt: null }, { ...search, maxAgeDays: 1 }, NOW)).toBe(
      true,
    );
  });
});

describe('mapBoardPosting', () => {
  const board = { ats: 'greenhouse', slug: 'acme-inc' } as const;

  it('maps a posting', () => {
    const { company, job } = mapBoardPosting(board, posting, NOW);
    expect(company).toEqual({ name: 'Acme Inc', domain: null, logoUrl: null });
    expect(job).toMatchObject({
      externalId: 'greenhouse:acme-inc:1',
      source: 'COMPANY_BOARD',
      provider: 'greenhouse',
      title: 'Senior Frontend Engineer',
      location: 'Berlin, Germany',
      jobFunction: 'Engineering',
      language: 'en',
      workplace: null,
      postingStatus: 'active',
    });
    expect(boardExternalId(board, '1')).toBe('greenhouse:acme-inc:1');
  });

  it('uses the feed company name, remote work place and today when there is no date', () => {
    const { company, job } = mapBoardPosting(
      board,
      { ...posting, company: 'Acme, Inc.', remote: true, postedAt: null },
      NOW,
    );
    expect(company.name).toBe('Acme, Inc.');
    expect(job.workplace).toBe('REMOTE');
    expect(job.postedAt).toEqual(NOW);
  });
});

describe('boardsOf and companyBoardsKey', () => {
  const input = (boards?: string[]) =>
    ({ titles: ['Frontend'], maxAgeDays: 7, remoteOnly: false, boards }) as SyncJobsInput;

  it('reads boards once each, from names or addresses', () => {
    const boards = boardsOf(
      input(['greenhouse:stripe', 'https://boards.greenhouse.io/stripe', 'lever:x']),
    );
    expect(boards.map(boardKey)).toEqual(['greenhouse:stripe', 'lever:x']);
  });

  it('names the board it cannot read', () => {
    expect(() => boardsOf(input(['nonsense']))).toThrow(/nonsense/);
  });

  it('needs at least one board', () => {
    expect(() => boardsOf(input([]))).toThrow(/at least one/);
    expect(() => boardsOf(input())).toThrow(/at least one/);
  });

  it('gives the same key whatever the order', () => {
    const a = boardsOf(input(['lever:x', 'ashby:y']));
    const b = boardsOf(input(['ashby:y', 'lever:x']));
    expect(companyBoardsKey(input(), a)).toBe(companyBoardsKey(input(), b));
  });
});
