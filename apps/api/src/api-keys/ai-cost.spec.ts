import { describe, expect, it } from 'vitest';
import { centsIn, costOf, currencyFor, priceOf, savedPercent, summedCost } from './ai-cost';

describe('kit cost', () => {
  it('finds the price by the longest matching model name', () => {
    expect(priceOf('claude-sonnet-5-5')?.input).toBe(2);
    expect(priceOf('claude-opus-5-5-20261001')?.cacheRead).toBe(0.2);
    expect(priceOf('claude-opus-5')?.input).toBe(5);
    expect(priceOf('gpt-5-mini')?.output).toBe(2);
    expect(priceOf('some-other-model')).toBeNull();
  });

  it('counts cached tokens cheaper and says what the cache saved', () => {
    // Sonnet 5.5: $2 in, $10 out, $0.10 cache read, $2.50 cache write per million tokens.
    const first = { input: 1000, output: 3000, cacheWrite: 6000, cacheRead: 0 };
    const second = { input: 1000, output: 3000, cacheWrite: 0, cacheRead: 6000 };
    const cost = costOf('claude-sonnet-5-5', [first, second]);
    // first: 2000 + 30000 + 15000; second: 2000 + 30000 + 600
    expect(cost?.costMicroUsd).toBe(79_600);
    // read saves 6000 x 1.90 = 11400; the write costs 6000 x 0.50 = 3000 more
    expect(cost?.savedMicroUsd).toBe(8_400);
    expect(savedPercent(cost!)).toBe(10);
    expect(costOf('unknown', [first])).toBeNull();
  });

  it('adds up kits and leaves out the ones with no price', () => {
    expect(summedCost([null, null])).toBeNull();
    expect(
      summedCost([
        { costMicroUsd: 10, savedMicroUsd: 1 },
        null,
        { costMicroUsd: 5, savedMicroUsd: 0 },
      ]),
    ).toEqual({ costMicroUsd: 15, savedMicroUsd: 1 });
    expect(savedPercent({ costMicroUsd: 100, savedMicroUsd: 0 })).toBe(0);
  });

  it('picks the currency from where you live', () => {
    expect(currencyFor('Hauptstr. 1, 10115 Berlin, Germany')).toBe('EUR');
    expect(currencyFor('')).toBe('EUR');
    expect(currencyFor('10 Downing St, London, United Kingdom')).toBe('GBP');
    expect(currencyFor('Austin, TX, USA')).toBe('USD');
    expect(currencyFor('Hausweg 2, Hamburg')).toBe('EUR');
    // $0.31 is about €0.29 and £0.24.
    expect(centsIn(310_000, 'USD')).toBe(31);
    expect(centsIn(310_000, 'EUR')).toBe(29);
    expect(centsIn(310_000, 'GBP')).toBe(24);
  });
});
