import { describe, expect, it } from 'vitest';
import { formatOrderNumber } from './order-number';

describe('order number formatting', () => {
  it('formats the first human order number without padding', () => {
    expect(formatOrderNumber(1001)).toBe('#1001');
  });

  it('keeps later order numbers readable without changing their value', () => {
    expect(formatOrderNumber(12843)).toBe('#12843');
  });
});
