import { describe, expect, it } from 'vitest';
import {
  assertOrderStatusTransition,
  createOrderSnapshotLines,
  getAllowedOrderStatusTransitions,
  getSubmissionStatus,
} from './utils';

describe('order domain utilities', () => {
  it('snapshots product name, unit price, quantity, and line total', () => {
    const lines = createOrderSnapshotLines({
      items: [
        { productId: 'prod-eggplant', quantity: 3 },
        { productId: 'prod-herb', quantity: 2 },
      ],
      products: [
        { id: 'prod-eggplant', name: 'ממרח חציל', price: 28 },
        { id: 'prod-herb', name: 'רוטב עשבים', price: 31 },
      ],
    });

    expect(lines).toEqual([
      {
        productId: 'prod-eggplant',
        productName: 'ממרח חציל',
        quantity: 3,
        listUnitPrice: 28,
        unitPrice: 28,
        lineSubtotal: 84,
        discountTotal: 0,
        lineTotal: 84,
        promotionId: null,
        promotionSnapshot: null,
      },
      {
        productId: 'prod-herb',
        productName: 'רוטב עשבים',
        quantity: 2,
        listUnitPrice: 31,
        unitPrice: 31,
        lineSubtotal: 62,
        discountTotal: 0,
        lineTotal: 62,
        promotionId: null,
        promotionSnapshot: null,
      },
    ]);
  });

  it('rejects quantities below the product minimum quantity', () => {
    const products = [{ id: 'prod-case', name: 'מארז מסעדה', price: 42, minQty: 6 }];

    expect(() =>
      createOrderSnapshotLines({
        items: [{ productId: 'prod-case', quantity: 2 }],
        products,
      }),
    ).toThrow('Minimum quantity');
  });

  it('marks submissions after the cutoff as special requests', () => {
    expect(
      getSubmissionStatus({
        now: new Date('2026-06-23T16:01:00.000Z'),
        cutoff: new Date('2026-06-23T15:00:00.000Z'),
      }),
    ).toBe('SPECIAL_REQUEST');
  });

  it('enforces allowed order status transitions', () => {
    expect(assertOrderStatusTransition('SUBMITTED', 'APPROVED')).toBe('APPROVED');
    expect(() => assertOrderStatusTransition('DELIVERED', 'APPROVED')).toThrow(
      'Invalid order status transition',
    );
  });

  it('lists the next allowed order status transitions for admin controls', () => {
    expect(getAllowedOrderStatusTransitions('SUBMITTED')).toEqual(['APPROVED', 'CANCELLED']);
    expect(getAllowedOrderStatusTransitions('APPROVED')).toEqual(['PACKED', 'CANCELLED']);
    expect(getAllowedOrderStatusTransitions('DELIVERED')).toEqual([]);
  });
});
