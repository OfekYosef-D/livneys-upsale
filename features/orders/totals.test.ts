import { describe, expect, it } from 'vitest';
import { calculateOrderTotals, calculateVat, toOrderTotals } from './totals';

describe('order totals', () => {
  it('applies promotions, then the immediate-payment discount, then VAT', () => {
    expect(calculateOrderTotals({ subtotal: 1000, discountTotal: 100, paymentTerm: 'IMMEDIATE_OR_CASH', vatRatePercent: 18 })).toEqual({
      subtotal: 1000,
      discountTotal: 100,
      paymentDiscountPercent: 5,
      paymentDiscountTotal: 45,
      total: 855,
      vatRatePercent: 18,
      vatTotal: 153.9,
      totalIncludingVat: 1008.9,
    });
  });

  it('gives no payment discount on net-30 terms', () => {
    const totals = calculateOrderTotals({ subtotal: 700, discountTotal: 0, paymentTerm: 'NET_30', vatRatePercent: 18 });
    expect(totals).toMatchObject({ paymentDiscountTotal: 0, total: 700, vatTotal: 126, totalIncludingVat: 826 });
  });

  it('rounds VAT to agorot and reads persisted Decimal-like values', () => {
    expect(calculateVat(10.01, 18)).toEqual({ vatRatePercent: 18, vatTotal: 1.8, totalIncludingVat: 11.81 });
    expect(toOrderTotals({
      subtotal: '100.50',
      discountTotal: 0,
      paymentDiscountPercent: null,
      paymentDiscountTotal: null,
      total: { toString: () => '100.5' },
      vatRatePercent: 18,
      vatTotal: 18.09,
      totalIncludingVat: 118.59,
    })).toMatchObject({ subtotal: 100.5, total: 100.5, paymentDiscountPercent: 0 });
  });
});
