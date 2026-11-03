/** The countries JobsPipe suggests, in its own order: [2-letter code, name]. */
const COUNTRIES: readonly (readonly [string, string])[] = [
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

/**
 * "DE" → "Germany" / "Deutschland". English keeps JobsPipe's names; other languages get the
 * browser's. A code nobody knows stays as it is.
 */
export function countryName(code: string, locale = 'en'): string {
  const upper = code.toUpperCase();
  const listed = locale === 'en' ? NAMES.get(upper) : undefined;
  if (listed) return listed;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(upper) ?? upper;
  } catch {
    return upper;
  }
}

/** JobsPipe's countries in its own order, named in your language. */
export function countriesIn(locale: string): (readonly [string, string])[] {
  return COUNTRIES.map(([code]) => [code, countryName(code, locale)] as const);
}
