import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JobsPipeSearchResponse } from '../../src/jobspipe/jobspipe.types';

/** A real JobsPipe response (3 jobs, descriptions shortened) used across tests. */
export function loadSearchResponse(): JobsPipeSearchResponse {
  const file = join(__dirname, 'jobspipe-search-response.json');
  return JSON.parse(readFileSync(file, 'utf8')) as JobsPipeSearchResponse;
}
