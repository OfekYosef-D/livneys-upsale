/** Rounds a shekel amount to agorot precision. Every monetary calculation must go through this. */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sumCurrency<T>(items: readonly T[], getAmount: (item: T) => number): number {
  return roundCurrency(items.reduce((sum, item) => sum + getAmount(item), 0));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const shekelFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number): string {
  return shekelFormatter.format(value);
}
