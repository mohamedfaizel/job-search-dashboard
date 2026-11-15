/**
 * Groups of countries you can pick in one go in the Countries picker. Picking a region adds all
 * of its codes to the search; the search itself still only stores country codes.
 */
export interface Region {
  /** The key of its name in the AddJobs.country.region messages. */
  id: 'dach' | 'eu' | 'benelux' | 'nordics' | 'ukIreland' | 'middleEast' | 'gcc';
  codes: readonly string[];
}

export const REGIONS: readonly Region[] = [
  { id: 'dach', codes: ['DE', 'AT', 'CH'] },
  {
    id: 'eu',
    codes: [
      'AT',
      'BE',
      'BG',
      'HR',
      'CY',
      'CZ',
      'DK',
      'EE',
      'FI',
      'FR',
      'DE',
      'GR',
      'HU',
      'IE',
      'IT',
      'LV',
      'LT',
      'LU',
      'MT',
      'NL',
      'PL',
      'PT',
      'RO',
      'SK',
      'SI',
      'ES',
      'SE',
    ],
  },
  { id: 'benelux', codes: ['BE', 'NL', 'LU'] },
  { id: 'nordics', codes: ['DK', 'SE', 'NO', 'FI', 'IS'] },
  { id: 'ukIreland', codes: ['GB', 'IE'] },
  {
    id: 'middleEast',
    codes: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'IL', 'JO', 'LB', 'IQ', 'EG', 'TR'],
  },
  { id: 'gcc', codes: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM'] },
];

/** How many of a region's countries are in `picked`. */
export function pickedIn(region: Region, picked: readonly string[]): number {
  return region.codes.filter((code) => picked.includes(code)).length;
}

/**
 * Splits the picked codes into whole regions and single countries, so a full DACH shows as one
 * "DACH" chip instead of three. Bigger regions win; a country is never in two chips.
 */
export function groupPicked(picked: readonly string[]): {
  regions: Region[];
  countries: string[];
} {
  const used = new Set<string>();
  const regions: Region[] = [];
  const bySize = [...REGIONS].sort((a, b) => b.codes.length - a.codes.length);
  for (const region of bySize) {
    const whole = region.codes.every((code) => picked.includes(code) && !used.has(code));
    if (!whole) continue;
    regions.push(region);
    for (const code of region.codes) used.add(code);
  }
  // Keep the regions in the list's order, not by size.
  regions.sort((a, b) => REGIONS.indexOf(a) - REGIONS.indexOf(b));
  return { regions, countries: picked.filter((code) => !used.has(code)) };
}
