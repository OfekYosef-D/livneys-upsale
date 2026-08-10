import { describe, expect, it } from 'vitest';
import { calculateVatSummary } from './vat';

describe('order VAT summary', () => {
  it('adds the standard 18 percent VAT to the discounted net order total', () => {
    expect(calculateVatSummary(674.31)).toEqual({
      vatRatePercent: 18,
      vatTotal: 121.38,
      totalIncludingVat: 795.69,
    });
  });

  it('rounds VAT once to agorot before composing the gross total', () => {
    expect(calculateVatSummary(117.28)).toEqual({
      vatRatePercent: 18,
      vatTotal: 21.11,
      totalIncludingVat: 138.39,
    });
  });

  it('returns a zero tax snapshot for an empty draft total', () => {
    expect(calculateVatSummary(0)).toEqual({
      vatRatePercent: 18,
      vatTotal: 0,
      totalIncludingVat: 0,
    });
  });
});

