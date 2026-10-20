import { describe, expect, it } from 'vitest';
import { assertMinimumOrderTotal, getMissingForMinimum, MINIMUM_INSTITUTIONAL_ORDER_TOTAL } from './business-rules';

describe('institutional order minimum', () => {
  it('blocks customer orders below the minimum but never admin (phone) orders', () => {
    expect(() => assertMinimumOrderTotal('CUSTOMER', MINIMUM_INSTITUTIONAL_ORDER_TOTAL)).not.toThrow();
    expect(() => assertMinimumOrderTotal('CUSTOMER', MINIMUM_INSTITUTIONAL_ORDER_TOTAL - 0.01)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => assertMinimumOrderTotal('ADMIN', 10)).not.toThrow();
  });

  it('reports how much is still missing for the cart progress bar', () => {
    expect(getMissingForMinimum(500)).toBe(MINIMUM_INSTITUTIONAL_ORDER_TOTAL - 500);
    expect(getMissingForMinimum(MINIMUM_INSTITUTIONAL_ORDER_TOTAL + 1)).toBe(0);
  });
});
