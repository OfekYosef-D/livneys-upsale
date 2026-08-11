import { describe, expect, it } from 'vitest';
import { buildOrderAdditionSnapshot } from './pricing';

const context = {
  customer: { id: 'cust-001', routeId: 'route-001', priceListId: 'price-list-001', isActive: true },
  route: {
    id: 'route-001',
    isActive: true,
    nextDeliveryAt: new Date('2026-08-19T08:00:00.000Z'),
    nextCutoffAt: new Date('2026-08-17T08:00:00.000Z'),
  },
  products: [{
    id: 'product-001',
    name: 'טחינה',
    category: 'ממרחים',
    basePrice: 100,
    isActive: true,
    minQty: 1,
    orderMultiple: 1,
  }],
  priceListItems: [{ productId: 'product-001', price: 100 }],
  promotions: [],
};

describe('order addition pricing snapshot', () => {
  it('uses the original immediate-payment term and snapshots VAT', () => {
    expect(buildOrderAdditionSnapshot({
      context,
      items: [{ productId: 'product-001', quantity: 2 }],
      paymentTerm: 'IMMEDIATE_OR_CASH',
      now: new Date('2026-08-11T12:00:00.000Z'),
    })).toMatchObject({
      subtotal: 200,
      discountTotal: 0,
      paymentDiscountPercent: 5,
      paymentDiscountTotal: 10,
      total: 190,
      vatRatePercent: 18,
      vatTotal: 34.2,
      totalIncludingVat: 224.2,
      lines: [{ productId: 'product-001', quantity: 2, listUnitPrice: 100, lineTotal: 200 }],
    });
  });

  it('prices quantity promotions against the combined order and addition quantity', () => {
    const buyTwoGetOne = {
      id: 'promo-001', title: '2+1', tag: '2+1', description: 'Buy two get one',
      effectType: 'BUY_X_GET_Y' as const, discountValue: null, buyQuantity: 2, freeQuantity: 1,
      priority: 10, startsAt: null, endsAt: null, isActive: true,
      productIds: ['product-001'], categories: [], customerIds: [], routeIds: [], priceListIds: [],
    };

    expect(buildOrderAdditionSnapshot({
      context: { ...context, promotions: [buyTwoGetOne] },
      existingItems: [{ productId: 'product-001', quantity: 2 }],
      items: [{ productId: 'product-001', quantity: 1 }],
      paymentTerm: 'NET_30',
      now: new Date('2026-08-11T12:00:00.000Z'),
    })).toMatchObject({
      subtotal: 100,
      discountTotal: 100,
      total: 0,
      vatTotal: 0,
      totalIncludingVat: 0,
      lines: [{ productId: 'product-001', quantity: 1, discountTotal: 100, lineTotal: 0 }],
    });
  });
});
