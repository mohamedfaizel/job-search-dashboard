import { JobSource, Workplace } from '../generated/prisma/enums';
import { detectLanguage } from '../insights/text';
import { visaSponsorship } from '../jobs/visa';
import type { MappedJob } from '../jobspipe/jobspipe.mapper';
import type { SyncJobsInput } from '../sync/sync.input';
import { boardKey, companyNameFromSlug } from './board-ref';
import type { BoardPosting, BoardRef } from './company-boards.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Our id for a posting: board and posting, so it can't equal an id from anywhere else. */
export const boardExternalId = (board: BoardRef, id: string) => `${boardKey(board)}:${id}`;

const words = (list: string[] | undefined) =>
  (list ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * Does a posting fit the search? The feeds can't be searched, so we read every posting of a board
 * and keep the ones that do. A filter the feed can't answer (no job type, no date) keeps the posting.
 */
export function fitsSearch(
  posting: BoardPosting,
  input: Pick<SyncJobsInput, 'titles' | 'maxAgeDays'> &
    Partial<Pick<SyncJobsInput, 'locations' | 'remoteOnly' | 'excludeTitles' | 'employmentTypes'>>,
  now = new Date(),
): boolean {
  const title = posting.title.toLowerCase();
  const titles = words(input.titles);
  if (titles.length > 0 && !titles.some((word) => title.includes(word))) return false;
  if (words(input.excludeTitles).some((word) => title.includes(word))) return false;

  const places = words(input.locations);
  const where = (posting.location ?? '').toLowerCase();
  if (places.length > 0 && !places.some((place) => where.includes(place))) return false;

  if (input.remoteOnly && posting.remote !== true) return false;

  const types = input.employmentTypes ?? [];
  if (types.length > 0 && posting.employmentType && !types.includes(posting.employmentType)) {
    return false;
  }
  if (posting.postedAt && posting.postedAt.getTime() < now.getTime() - input.maxAgeDays * DAY_MS) {
    return false;
  }
  return true;
}

/** Converts one posting into the shape we store. */
export function mapBoardPosting(
  board: BoardRef,
  posting: BoardPosting,
  now = new Date(),
): MappedJob {
  return {
    company: {
      name: posting.company ?? companyNameFromSlug(board.slug),
      domain: null,
      logoUrl: null,
    },
    job: {
      externalId: boardExternalId(board, posting.id),
      source: JobSource.COMPANY_BOARD,
      title: posting.title.trim(),
      url: posting.url,
      postedAt: posting.postedAt ?? now,
      jobFunction: posting.department,
      skills: [],
      location: posting.location,
      language: detectLanguage(posting.description),
      provider: board.ats,
      workplace: posting.remote === true ? Workplace.REMOTE : null,
      visa: visaSponsorship(posting.description),
      description: posting.description,
      postingStatus: 'active',
      raw: posting.raw as NonNullable<MappedJob['job']['raw']>,
    },
  };
}
