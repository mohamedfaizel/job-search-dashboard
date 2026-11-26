/**
 * A small cost such as "€0.31", in the app's language. Under one cent shows as "< €0.01", so a
 * cheap kit never looks free.
 */
export function formatCost(cents: number, currency: string, locale: string): string {
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 1 ? `< ${money.format(0.01)}` : money.format(cents / 100);
}
