import type { AiUsage } from './ai-providers';

/** US dollars per million tokens. */
interface Price {
  input: number;
  output: number;
  /** A prompt token read from the cache. */
  cacheRead: number;
  /** A prompt token written to the cache. */
  cacheWrite: number;
}

const claude = (input: number, output: number, cacheRead = input / 10): Price => ({
  input,
  output,
  cacheRead,
  cacheWrite: input * 1.25,
});
const openai = (input: number, output: number): Price => ({
  input,
  output,
  cacheRead: input / 10,
  cacheWrite: input,
});

/**
 * List prices by model name start, longest first wins. They change now and then, so a cost shown
 * in the app is "about". A model not listed has no price, and the app shows no cost for it.
 */
const PRICES: [string, Price][] = [
  ['claude-fable-5-2', claude(8, 40, 0.2)],
  ['claude-fable-5', claude(10, 50)],
  ['claude-opus-5-5', claude(4, 20, 0.2)],
  ['claude-opus-5', claude(5, 25)],
  ['claude-opus-4', claude(5, 25)],
  ['claude-sonnet-5-5', claude(2, 10, 0.1)],
  ['claude-sonnet-5', claude(2, 10)],
  ['claude-sonnet-4', claude(3, 15)],
  ['claude-haiku-5-5', claude(0.1, 0.5)],
  ['claude-haiku-4', claude(1, 5)],
  ['gpt-5-nano', openai(0.05, 0.4)],
  ['gpt-5-mini', openai(0.25, 2)],
  ['gpt-5', openai(1.25, 10)],
];

export function priceOf(model: string): Price | null {
  const found = PRICES.filter(([start]) => model.startsWith(start)).sort(
    (a, b) => b[0].length - a[0].length,
  )[0];
  return found?.[1] ?? null;
}

/** What one or more calls cost, and what the cache saved, in millionths of a US dollar. */
export interface CallCost {
  costMicroUsd: number;
  savedMicroUsd: number;
}

/** Adds up calls. Null when the model has no known price. */
export function costOf(model: string, calls: AiUsage[]): CallCost | null {
  const price = priceOf(model);
  if (!price) return null;
  let cost = 0;
  let saved = 0;
  for (const call of calls) {
    cost +=
      call.input * price.input +
      call.output * price.output +
      call.cacheRead * price.cacheRead +
      call.cacheWrite * price.cacheWrite;
    // Without the cache, every cached token would have cost the normal input price.
    saved +=
      call.cacheRead * (price.input - price.cacheRead) -
      call.cacheWrite * (price.cacheWrite - price.input);
  }
  // Price per million tokens times tokens = millionths of a dollar.
  return { costMicroUsd: Math.round(cost), savedMicroUsd: Math.round(saved) };
}

export type Currency = 'EUR' | 'GBP' | 'USD';

/** About what one US dollar is worth. Costs are small, so a fixed rate is close enough. */
const PER_USD: Record<Currency, number> = { USD: 1, EUR: 0.92, GBP: 0.79 };

/**
 * Your currency from where you live: pounds in the UK, dollars in the US, else euros (the app is
 * made for jobs in Germany and the EU). The address on My profile says where you live.
 */
export function currencyFor(address: string): Currency {
  const text = ` ${address.toLowerCase()} `;
  if (/\b(united kingdom|uk|england|scotland|wales|northern ireland|great britain|gb)\b/.test(text))
    return 'GBP';
  if (/\b(united states|usa|u\.s\.a?\.?|us)\b/.test(text)) return 'USD';
  return 'EUR';
}

/** Millionths of a dollar in cents (or pence) of your currency, rounded. */
export function centsIn(microUsd: number, currency: Currency): number {
  return Math.round((microUsd / 10_000) * PER_USD[currency]);
}

/** The kits' costs added up. Null when none has a known price. */
export function summedCost(costs: (CallCost | null)[]): CallCost | null {
  const known = costs.filter((c): c is CallCost => c !== null);
  if (known.length === 0) return null;
  return {
    costMicroUsd: known.reduce((sum, c) => sum + c.costMicroUsd, 0),
    savedMicroUsd: known.reduce((sum, c) => sum + c.savedMicroUsd, 0),
  };
}

/** What the cache saved, in % of what the run would have cost without it. */
export function savedPercent(cost: CallCost): number {
  const without = cost.costMicroUsd + cost.savedMicroUsd;
  return without > 0 && cost.savedMicroUsd > 0
    ? Math.round((cost.savedMicroUsd / without) * 100)
    : 0;
}
