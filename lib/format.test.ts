import { describe, expect, it } from 'vitest';
import { money } from './format';

describe('money', () => {
  it('shows agorot instead of rounding institutional unit prices to whole shekels', () => {
    const formatted = money(16.9);

    expect(formatted).toContain('16.90');
    expect(formatted).toContain('₪');
  });

  it('keeps two decimal places for financial totals', () => {
    expect(money(700)).toContain('700.00');
  });
});

