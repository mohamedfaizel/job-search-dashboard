import { describe, expect, it } from 'vitest';
import { arbeitsagenturKey, workTimeFilter } from './arbeitsagentur-sync.service';
import {
  baExternalId,
  baUrl,
  isUsable,
  mapArbeitsagenturJob,
  plainText,
} from './arbeitsagentur.mapper';
import type { BaListing } from './arbeitsagentur.types';

const listing = {
  refnr: '10001-1002345678-S',
  titel: ' Frontend Entwickler (m/w/d) ',
  beruf: 'Softwareentwickler/in',
  arbeitgeber: 'Beispiel GmbH',
  arbeitsort: { plz: '10115', ort: 'Berlin', region: 'Berlin', land: 'Deutschland' },
  aktuelleVeroeffentlichungsdatum: '2026-11-02',
} satisfies BaListing;

describe('mapArbeitsagenturJob', () => {
  it('maps a listing with its full ad', () => {
    const { company, job } = mapArbeitsagenturJob(
      listing,
      {
        stellenbeschreibung:
          '<p>Wir suchen Verstärkung für unser Team in Berlin. Sie entwickeln mit React und TypeScript moderne Weboberflächen.</p><ul><li>Erfahrung mit React</li></ul>',
      },
      new Date('2026-11-03T08:00:00Z'),
    );

    expect(company).toEqual({ name: 'Beispiel GmbH', domain: null, logoUrl: null });
    expect(job).toMatchObject({
      externalId: 'ba:10001-1002345678-S',
      source: 'ARBEITSAGENTUR',
      title: 'Frontend Entwickler (m/w/d)',
      url: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/10001-1002345678-S',
      jobFunction: 'Softwareentwickler/in',
      city: 'Berlin',
      location: 'Berlin, Berlin',
      countryCode: 'DE',
      language: 'de',
      provider: 'arbeitsagentur',
      postingStatus: 'active',
    });
    expect(job.postedAt).toEqual(new Date('2026-11-02'));
    expect(job.description).toContain('- Erfahrung mit React');
    expect(job.description).not.toContain('<');
  });

  it('still saves a job whose full ad could not be read', () => {
    const { job } = mapArbeitsagenturJob(listing, null, new Date('2026-11-03T08:00:00Z'));
    expect(job.description).toBeNull();
    expect(job.language).toBe('de');
  });

  it('falls back to now for a missing or broken date', () => {
    const now = new Date('2026-11-03T08:00:00Z');
    const none = mapArbeitsagenturJob(
      { ...listing, aktuelleVeroeffentlichungsdatum: undefined },
      null,
      now,
    );
    const broken = mapArbeitsagenturJob(
      { ...listing, aktuelleVeroeffentlichungsdatum: 'x' },
      null,
      now,
    );
    expect(none.job.postedAt).toEqual(now);
    expect(broken.job.postedAt).toEqual(now);
  });

  it('detects an English ad', () => {
    const { job } = mapArbeitsagenturJob(
      listing,
      {
        stellenbeschreibung:
          'We are looking for a frontend developer to join our team. You will build web applications with React and work closely with designers.',
      },
      new Date(),
    );
    expect(job.language).toBe('en');
  });
});

describe('helpers', () => {
  it('prefixes ids and builds the public link', () => {
    expect(baExternalId('A-1')).toBe('ba:A-1');
    expect(baUrl('A-1')).toBe('https://www.arbeitsagentur.de/jobsuche/jobdetail/A-1');
  });

  it('needs a reference number, title and employer', () => {
    expect(isUsable(listing)).toBe(true);
    expect(isUsable({ ...listing, refnr: undefined })).toBe(false);
    expect(isUsable({ ...listing, titel: '' })).toBe(false);
    expect(isUsable({ ...listing, arbeitgeber: undefined })).toBe(false);
  });

  it('turns HTML into plain text', () => {
    expect(plainText('<p>A &amp; B</p><p>C<br/>D</p>')).toBe('A & B\nC\nD');
    expect(plainText('')).toBeNull();
    expect(plainText(undefined)).toBeNull();
    expect(plainText('<p> </p>')).toBeNull();
  });

  it('keeps the same search under the same key', () => {
    const a = arbeitsagenturKey({ titles: ['React', 'frontend'], locations: ['Berlin'] } as never);
    const b = arbeitsagenturKey({
      titles: ['frontend', ' react '],
      locations: ['berlin'],
    } as never);
    expect(a).toBe(b);
    expect(a).not.toBe(arbeitsagenturKey({ titles: ['frontend'], locations: [] } as never));
  });

  it('maps job types and remote to the board’s work-time filter', () => {
    expect(
      workTimeFilter({ employmentTypes: ['full-time', 'part-time'], remoteOnly: true } as never),
    ).toEqual(['vz', 'tz', 'ho']);
    expect(workTimeFilter({ employmentTypes: ['contract'], remoteOnly: false } as never)).toEqual(
      [],
    );
    expect(workTimeFilter({} as never)).toEqual([]);
  });
});
