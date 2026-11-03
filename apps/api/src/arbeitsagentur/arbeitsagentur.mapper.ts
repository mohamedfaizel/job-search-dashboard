import { JobSource } from '../generated/prisma/enums';
import { detectLanguage } from '../insights/text';
import { visaSponsorship } from '../jobs/visa';
import type { MappedJob } from '../jobspipe/jobspipe.mapper';
import type { BaDetail, BaListing } from './arbeitsagentur.types';

/** Our id for a posting: prefixed, so it can never equal an id from another source. */
export const baExternalId = (refnr: string) => `ba:${refnr}`;

/** The public page of an ad on arbeitsagentur.de. */
export const baUrl = (refnr: string) => `https://www.arbeitsagentur.de/jobsuche/jobdetail/${refnr}`;

/** Their descriptions can carry HTML tags and entities; we keep plain text with line breaks. */
export function plainText(value: string | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
  return text || null;
}

/** A listing is only usable with a reference number, a title and an employer. */
export function isUsable(listing: BaListing): listing is BaListing & {
  refnr: string;
  titel: string;
  arbeitgeber: string;
} {
  return Boolean(listing.refnr && listing.titel && listing.arbeitgeber);
}

/** Converts one listing (plus its full ad, when we could fetch it) into the shape we store. */
export function mapArbeitsagenturJob(
  listing: BaListing & { refnr: string; titel: string; arbeitgeber: string },
  detail: BaDetail | null,
  now = new Date(),
): MappedJob {
  const description = plainText(detail?.stellenbeschreibung);
  const place = listing.arbeitsort;
  const posted = new Date(
    listing.aktuelleVeroeffentlichungsdatum ?? listing.modifikationsTimestamp ?? now,
  );
  return {
    company: { name: listing.arbeitgeber.trim(), domain: null, logoUrl: null },
    job: {
      externalId: baExternalId(listing.refnr),
      source: JobSource.ARBEITSAGENTUR,
      title: listing.titel.trim(),
      url: baUrl(listing.refnr),
      postedAt: Number.isNaN(posted.getTime()) ? now : posted,
      jobFunction: listing.beruf ?? null,
      skills: [],
      city: place?.ort ?? null,
      location: [place?.ort, place?.region].filter(Boolean).join(', ') || null,
      // The board only lists jobs in Germany.
      countryCode: 'DE',
      // Most ads are German; the detector overrules that for an English one.
      language: detectLanguage(description) ?? 'de',
      provider: 'arbeitsagentur',
      visa: visaSponsorship(description),
      description,
      postingStatus: 'active',
      raw: listing as unknown as NonNullable<MappedJob['job']['raw']>,
    },
  };
}
