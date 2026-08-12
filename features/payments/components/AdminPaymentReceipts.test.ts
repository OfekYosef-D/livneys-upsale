import { describe, expect, it } from 'vitest';
import { getReceiptAmountForOutstanding } from './receipt-amount';

describe('admin payment receipt amount', () => {
  it('tracks the refreshed outstanding balance and clears a paid order', () => {
    expect(getReceiptAmountForOutstanding(40)).toBe('40');
    expect(getReceiptAmountForOutstanding(40.25)).toBe('40.25');
    expect(getReceiptAmountForOutstanding(0)).toBe('');
  });
});
