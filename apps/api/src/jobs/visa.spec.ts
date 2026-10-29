import { describe, expect, it } from 'vitest';
import { visaSponsorship } from './visa';

describe('visaSponsorship', () => {
  it.each([
    'We offer visa sponsorship and relocation support.',
    'We sponsor your work visa if you need one.',
    'Relocation package and help with your Blue Card.',
    'Wir unterstützen dich beim Umzug und beim Visum.',
    'Umzugshilfe inklusive.',
  ])('reads an offer in "%s"', (text) => {
    expect(visaSponsorship(text)).toBe('OFFERS');
  });

  it.each([
    'Unfortunately we cannot offer visa sponsorship.',
    'This role does not include sponsorship.',
    'You must already have the right to work in Germany.',
    'Candidates must hold a valid work permit for the EU.',
    'US citizenship required.',
    'Wir bieten leider kein Visum an.',
    'Eine gültige Arbeitserlaubnis ist Voraussetzung.',
  ])('reads a no in "%s"', (text) => {
    expect(visaSponsorship(text)).toBe('NO');
  });

  it('checks "no" first, because those ads name visas too', () => {
    expect(visaSponsorship('No visa sponsorship. Relocation support is not offered.')).toBe('NO');
  });

  it('says nothing when the ad says nothing', () => {
    expect(visaSponsorship('Build React apps with a friendly team.')).toBe('NOT_STATED');
    expect(visaSponsorship(null)).toBe('NOT_STATED');
  });

  it('does not read words that only contain "no"', () => {
    expect(visaSponsorship('Our piano visa programme… we offer visa sponsorship.')).toBe('OFFERS');
  });

  it("prefers JobsPipe's own label", () => {
    expect(visaSponsorship('We offer visa sponsorship.', 'no')).toBe('NO');
    expect(visaSponsorship('', 'offers')).toBe('OFFERS');
    expect(visaSponsorship('', 'citizenship_required')).toBe('NO');
  });
});
