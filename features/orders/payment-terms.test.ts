import { describe, expect, it } from 'vitest';
import { calculatePaymentTermsSummary } from './payment-terms';

describe('order payment terms', () => {
  it('keeps net 30 orders at the amount after product promotions', () => {
    expect(calculatePaymentTermsSummary(900, 'NET_30')).toEqual({
      paymentDiscountPercent: 0,
      paymentDiscountTotal: 0,
      total: 900,
    });
  });

  it('applies five percent to the amount after product promotions', () => {
    expect(calculatePaymentTermsSummary(900, 'IMMEDIATE_OR_CASH')).toEqual({
      paymentDiscountPercent: 5,
      paymentDiscountTotal: 45,
      total: 855,
    });
  });

  it('rounds the discount and final total to agorot', () => {
    expect(calculatePaymentTermsSummary(123.45, 'IMMEDIATE_OR_CASH')).toEqual({
      paymentDiscountPercent: 5,
      paymentDiscountTotal: 6.17,
      total: 117.28,
    });
  });
});
