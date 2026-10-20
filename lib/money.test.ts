import { describe, expect, it } from 'vitest';
import { clamp, formatMoney, roundCurrency, sumCurrency } from './money';

describe('money helpers', () => {
  it('rounds to agorot without floating point drift', () => {
    expect(roundCurrency(1.005)).toBe(1.01);
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
    expect(sumCurrency([{ v: 0.1 }, { v: 0.2 }, { v: 0.7 }], (item) => item.v)).toBe(1);
  });

  it('clamps and formats shekel amounts', () => {
    expect(clamp(120, 0, 100)).toBe(100);
    expect(formatMoney(1234.5)).toContain('1,234.50');
    expect(formatMoney(1234.5)).toContain('₪');
  });
});
