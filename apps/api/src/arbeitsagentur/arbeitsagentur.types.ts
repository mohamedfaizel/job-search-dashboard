/**
 * The parts of the Federal Employment Agency's job search API (jobsuche-service) we read.
 * The API is public and free; it is described at https://jobsuche.api.bund.dev.
 * Every field is optional on purpose: a posting with a gap is still a posting.
 */
export interface BaSearchResponse {
  stellenangebote?: BaListing[];
  /** Total matches for the search. */
  maxErgebnisse?: number | string;
  page?: number;
  size?: number;
}

export interface BaListing {
  /** Reference number, e.g. "10001-1002345678-S". Unique per posting. */
  refnr?: string | undefined;
  titel?: string | undefined;
  /** The job's occupation, e.g. "Softwareentwickler/in". */
  beruf?: string | undefined;
  arbeitgeber?: string | undefined;
  arbeitsort?: BaPlace | undefined;
  /** "2026-11-02". */
  aktuelleVeroeffentlichungsdatum?: string | undefined;
  eintrittsdatum?: string | undefined;
  modifikationsTimestamp?: string | undefined;
  /** The employer's own page for the ad, when it has one. */
  externeUrl?: string | undefined;
}

export interface BaPlace {
  plz?: string | undefined;
  ort?: string | undefined;
  region?: string | undefined;
  land?: string | undefined;
}

export interface BaDetail {
  stellenbeschreibung?: string | undefined;
  arbeitgeber?: string | undefined;
  titel?: string | undefined;
}
