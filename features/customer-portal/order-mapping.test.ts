import { describe, expect, it } from 'vitest';
import { mapPortalOrder } from './order-mapping';

describe('customer portal order mapping', () => {
  it('preserves saved order line snapshots and totals for historical orders', () => {
    const createdAt = new Date('2026-06-20T09:00:00.000Z');
    const submittedAt = new Date('2026-06-21T09:00:00.000Z');

    const order = mapPortalOrder(
      {
        id: 'ord-history',
        orderNumber: 1001,
        customerId: 'cust-001',
        createdAt,
        submittedAt,
        status: 'SUBMITTED',
        subtotal: 100,
        discountTotal: 16,
        paymentTerm: 'IMMEDIATE_OR_CASH',
        paymentDiscountPercent: 5,
        paymentDiscountTotal: 4.2,
        total: 79.8,
        lines: [
          {
            productId: 'prod-old',
            productName: 'מחיר היסטורי',
            quantity: 2,
            listUnitPrice: 50,
            unitPrice: 42,
            lineSubtotal: 100,
            discountTotal: 16,
            lineTotal: 84,
            promotionId: 'promo-old',
            promotionSnapshot: { id: 'promo-old', tag: 'מבצע', title: 'מבצע', description: 'ישן', effectType: 'FIXED_UNIT_PRICE' },
          },
        ],
      },
      'cust-001',
    );

    expect(order).toEqual({
      id: 'ord-history',
      orderNumber: 1001,
      customerId: 'cust-001',
      date: submittedAt.toISOString(),
      status: 'SUBMITTED',
      subtotal: 100,
      discountTotal: 16,
      paymentTerm: 'IMMEDIATE_OR_CASH',
      paymentDiscountPercent: 5,
      paymentDiscountTotal: 4.2,
      total: 79.8,
      items: [
        {
          productId: 'prod-old',
          productName: 'מחיר היסטורי',
          qty: 2,
          listUnitPrice: 50,
          unitPrice: 42,
          lineSubtotal: 100,
          discountTotal: 16,
          lineTotal: 84,
          promotionLabel: 'מבצע',
        },
      ],
    });
  });
});
