import { describe, expect, it } from 'vitest';
import { formatCost } from './money';

describe('formatCost', () => {
  it('shows cents in the currency, and never zero', () => {
    expect(formatCost(31, 'EUR', 'en')).toBe('€0.31');
    expect(formatCost(31, 'EUR', 'de')).toBe('0,31\u00a0€');
    expect(formatCost(124, 'GBP', 'en')).toBe('£1.24');
    expect(formatCost(0, 'USD', 'en')).toBe('< $0.01');
  });
});
