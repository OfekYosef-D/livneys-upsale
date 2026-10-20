import { describe, expect, it } from 'vitest';
import { parseOrderQuantity } from './QuantityStepper';

describe('parseOrderQuantity', () => {
  it('accepts zero (remove) and valid case-size multiples typed from a keyboard', () => {
    expect(parseOrderQuantity('0', 6, 6)).toBe(0);
    expect(parseOrderQuantity('6', 6, 6)).toBe(6);
    expect(parseOrderQuantity('24', 6, 6)).toBe(24);
    expect(parseOrderQuantity('066', 6, 6)).toBe(66);
  });

  it('rejects empty, non-numeric, fractional and negative drafts', () => {
    expect(parseOrderQuantity('', 1, 1)).toBeNull();
    expect(parseOrderQuantity('abc', 6, 6)).toBeNull();
    expect(parseOrderQuantity('2.5', 1, 1)).toBeNull();
    expect(parseOrderQuantity('-6', 1, 1)).toBeNull();
    expect(parseOrderQuantity(' 6', 1, 1)).toBeNull();
  });

  it('rejects below-minimum and off-multiple quantities', () => {
    expect(parseOrderQuantity('3', 6, 6)).toBeNull();
    expect(parseOrderQuantity('7', 6, 6)).toBeNull();
    // A partially typed "67" is invalid even though its prefix "6" was valid.
    expect(parseOrderQuantity('67', 6, 6)).toBeNull();
    expect(parseOrderQuantity('4', 5, 1)).toBeNull();
  });

  it('treats a minimum below 1 as 1 and a step below 1 as 1', () => {
    expect(parseOrderQuantity('1', 0, 0)).toBe(1);
    expect(parseOrderQuantity('7', 0, 0.5)).toBe(7);
  });

  it('rejects numbers beyond the safe integer range', () => {
    expect(parseOrderQuantity('99999999999999999999', 1, 1)).toBeNull();
  });
});
