import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JobHunterSearchResponse } from '../../src/jobhunter/jobhunter.types';

/** A real JobHunter response (3 jobs, descriptions shortened) used across tests. */
export function loadSearchResponse(): JobHunterSearchResponse {
  const file = join(__dirname, 'jobhunter-search-response.json');
  return JSON.parse(readFileSync(file, 'utf8')) as JobHunterSearchResponse;
}
