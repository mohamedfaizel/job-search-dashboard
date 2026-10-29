/** The countries JobsPipe suggests, in its own order: [2-letter code, name]. */
export const COUNTRIES: readonly (readonly [string, string])[] = [
  ['US', 'United States'],
  ['GB', 'United Kingdom'],
  ['CA', 'Canada'],
  ['AU', 'Australia'],
  ['IE', 'Ireland'],
  ['NZ', 'New Zealand'],
  ['IN', 'India'],
  ['SG', 'Singapore'],
  ['HK', 'Hong Kong SAR'],
  ['PH', 'Philippines'],
  ['MY', 'Malaysia'],
  ['ID', 'Indonesia'],
  ['JP', 'Japan'],
  ['KR', 'South Korea'],
  ['AE', 'United Arab Emirates'],
  ['IL', 'Israel'],
  ['SA', 'Saudi Arabia'],
  ['QA', 'Qatar'],
  ['KW', 'Kuwait'],
  ['BH', 'Bahrain'],
  ['OM', 'Oman'],
  ['EG', 'Egypt'],
  ['TR', 'Turkey'],
  ['JO', 'Jordan'],
  ['LB', 'Lebanon'],
  ['PK', 'Pakistan'],
  ['MA', 'Morocco'],
  ['TN', 'Tunisia'],
  ['IQ', 'Iraq'],
  ['DZ', 'Algeria'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['NL', 'Netherlands'],
  ['BE', 'Belgium'],
  ['ES', 'Spain'],
  ['IT', 'Italy'],
  ['CH', 'Switzerland'],
  ['AT', 'Austria'],
  ['SE', 'Sweden'],
  ['DK', 'Denmark'],
  ['NO', 'Norway'],
  ['PL', 'Poland'],
  ['BR', 'Brazil'],
  ['MX', 'Mexico'],
  ['ZA', 'South Africa'],
];

const NAMES = new Map(COUNTRIES);
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** "DE" → "Germany". Codes outside the list get the browser's name, or stay as they are. */
export function countryName(code: string): string {
  const upper = code.toUpperCase();
  try {
    return NAMES.get(upper) ?? regionNames.of(upper) ?? upper;
  } catch {
    return upper;
  }
}
