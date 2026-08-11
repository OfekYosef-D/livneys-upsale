import { describe, expect, it } from 'vitest';
import { finalizeOrderQuantity, parseOrderQuantity } from './QuantityStepper';

describe('editable order quantity', () => {
  it('accepts zero and valid case-size multiples typed from a keyboard', () => {
    expect(parseOrderQuantity('0', 6, 6)).toBe(0);
    expect(parseOrderQuantity('24', 6, 6)).toBe(24);
  });

  it('rejects non-numeric, fractional, below-minimum, and invalid-multiple values', () => {
    expect(parseOrderQuantity('abc', 6, 6)).toBeNull();
    expect(parseOrderQuantity('2.5', 1, 1)).toBeNull();
    expect(parseOrderQuantity('3', 6, 6)).toBeNull();
    expect(parseOrderQuantity('7', 6, 6)).toBeNull();
  });

  it('restores the pre-edit quantity when a partially valid draft ends invalid', () => {
    expect(finalizeOrderQuantity('67', 6, 6, 24)).toBe(24);
    expect(finalizeOrderQuantity('66', 6, 6, 24)).toBe(66);
  });
});
