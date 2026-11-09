import { pickLocale } from '../i18n/messages';
import { colors, fitColors } from './theme';

describe('fitColors', () => {
  it('is green from 75, orange from 50, red below', () => {
    expect(fitColors(75).fg).toBe(colors.green);
    expect(fitColors(50).fg).toBe(colors.orange);
    expect(fitColors(49).fg).toBe(colors.redText);
  });
});

describe('pickLocale', () => {
  it('takes the first language the app has, else English', () => {
    expect(pickLocale(undefined, 'de')).toBe('de');
    expect(pickLocale('en', 'de')).toBe('en');
    expect(pickLocale(null, 'fr')).toBe('en');
  });
});
