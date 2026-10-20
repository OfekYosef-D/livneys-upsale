import { describe, expect, it } from 'vitest';
import { getFirstValidQuantity, getQuantityError, normalizeOrderItems, roundUpToValidQuantity } from './quantity';

const jar = { id: 'jar', name: 'ממרח', minQty: 6, orderMultiple: 6 };
const single = { id: 'single', name: 'רוטב', minQty: 2, orderMultiple: 1 };

describe('order quantity rules', () => {
  it('explains minimum and case-multiple violations in Hebrew', () => {
    expect(getQuantityError(jar, 12)).toBeNull();
    expect(getQuantityError(jar, 3)).toContain('המינימלית');
    expect(getQuantityError(jar, 8)).toContain('בכפולות של 6');
    expect(getQuantityError(single, 3)).toBeNull();
  });

  it('rounds re-ordered quantities up to the current rules', () => {
    expect(getFirstValidQuantity({ minQty: 4, orderMultiple: 6 })).toBe(6);
    expect(roundUpToValidQuantity(jar, 7)).toBe(12);
    expect(roundUpToValidQuantity(jar, 2)).toBe(6);
    expect(roundUpToValidQuantity(jar, 0)).toBe(0);
  });

  it('merges duplicate lines, drops unknown products and empty lines, then validates', () => {
    expect(normalizeOrderItems(
      [{ productId: 'jar', quantity: 6 }, { productId: 'jar', quantity: 6 }, { productId: 'gone', quantity: 6 }, { productId: 'single', quantity: 0 }],
      [jar, single],
    )).toEqual([{ productId: 'jar', quantity: 12 }]);

    expect(() => normalizeOrderItems([{ productId: 'jar', quantity: 5 }], [jar])).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
