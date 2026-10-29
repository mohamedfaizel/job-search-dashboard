import { VisaSponsorship } from '../generated/prisma/enums';

/** Ads that rule sponsorship out: "no visa sponsorship", "must already have the right to work". */
const SAYS_NO = new RegExp(
  [
    "\\b(?:no|not|unable to|cannot|can't|can not|do not|don't|does not|doesn't|will not|won't|without)\\b[^.\\n]{0,40}\\b(?:visa|sponsor)",
    '(?:must|need to|required to|should)\\s+(?:already\\s+)?(?:have|hold|possess)\\s+(?:a\\s+|the\\s+|an\\s+)?(?:valid\\s+)?(?:right to work|work(?:ing)? (?:permit|authori[sz]ation)|eu (?:citizenship|work permit))',
    'citizenship (?:is )?required',
    'security clearance (?:is )?required',
    '\\bkeine?\\b[^.\\n]{0,30}\\b(?:visum|visa|arbeitserlaubnis|aufenthaltstitel)',
    '(?:gültige|gueltige|bestehende)\\s+(?:arbeitserlaubnis|aufenthalts- und arbeitserlaubnis|arbeitsgenehmigung)\\s+(?:ist\\s+)?(?:erforderlich|voraussetzung|notwendig)',
  ].join('|'),
  'i',
);

/** Ads that offer help: visa sponsorship, Blue Card support, relocation help, Umzugshilfe. */
const OFFERS = new RegExp(
  [
    'visa sponsorship',
    'sponsor(?:ship)?\\s+(?:of\\s+)?(?:your\\s+|a\\s+|the\\s+)?(?:work\\s+)?visa',
    'visa (?:support|assistance|help)',
    'help (?:you )?with (?:your )?(?:visa|relocation)',
    'relocation (?:support|package|assistance|bonus|help)',
    'blue card',
    'blaue karte',
    'visum',
    'umzugshilfe',
    'umzugskosten',
    'relocation-(?:unterstützung|paket)',
    'unterstützen (?:dich|sie) (?:beim|bei (?:dem|der|deinem|ihrem)) (?:umzug|visum|relocation)',
  ].join('|'),
  'i',
);

/**
 * What a job ad says about visa sponsorship, read with plain patterns (no AI, no credits).
 * JobsPipe's own label wins when it has one; it labels only about 2% of ads, so the description
 * decides the rest. "No sponsorship" is checked first, because those ads name visas too.
 */
export function visaSponsorship(
  description: string | null,
  jobsPipeValue?: string | null,
): VisaSponsorship {
  if (jobsPipeValue === 'offers') return VisaSponsorship.OFFERS;
  if (jobsPipeValue === 'no' || jobsPipeValue === 'citizenship_required') {
    return VisaSponsorship.NO;
  }
  const text = description ?? '';
  if (SAYS_NO.test(text)) return VisaSponsorship.NO;
  if (OFFERS.test(text)) return VisaSponsorship.OFFERS;
  return VisaSponsorship.NOT_STATED;
}
