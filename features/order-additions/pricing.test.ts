import { describe, expect, it } from 'vitest';
import { buildOrderAdditionSnapshot } from './pricing';

const context = {
  customerId: 'cust-001',
  routeId: 'route-001',
  vatRatePercent: 18,
  schedule: { deliveryAt: new Date('2026-08-19T08:00:00.000Z'), cutoffAt: new Date('2026-08-17T08:00:00.000Z') },
  pricing: {
    target: { customerId: 'cust-001', routeId: 'route-001', priceListId: 'price-list-001' },
    products: [{ id: 'product-001', name: 'טחינה', category: 'ממרחים', basePrice: 100, isActive: true, minQty: 1, orderMultiple: 1 }],
    priceListItems: [{ productId: 'product-001', price: 100 }],
    promotions: [] as import('../pricing/engine').PricingPromotion[],
  },
};

describe('order addition pricing snapshot', () => {
  it('returns a safe validation error for an empty addition', () => {
    expect(() => buildOrderAdditionSnapshot({
      context,
      existingItems: [],
      items: [],
      paymentTerm: 'NET_30',
      now: new Date('2026-08-11T12:00:00.000Z'),
    })).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('uses the original immediate-payment term and snapshots VAT', () => {
    expect(buildOrderAdditionSnapshot({
      context,
      existingItems: [],
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
      context: { ...context, pricing: { ...context.pricing, promotions: [buyTwoGetOne] } },
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

  it('does not discount units twice when the original order already earned the deal', () => {
    const buyTwoGetOne = {
      id: 'promo-001', title: '2+1', tag: '2+1', description: '', effectType: 'BUY_X_GET_Y' as const, discountValue: null,
      buyQuantity: 2, freeQuantity: 1, priority: 10, startsAt: null, endsAt: null, isActive: true,
      productIds: [], categories: [], customerIds: [], routeIds: [], priceListIds: [],
    };
    expect(buildOrderAdditionSnapshot({
      context: { ...context, pricing: { ...context.pricing, promotions: [buyTwoGetOne] } },
      existingItems: [{ productId: 'product-001', quantity: 3 }],
      items: [{ productId: 'product-001', quantity: 1 }],
      paymentTerm: 'NET_30',
      now: new Date('2026-08-11T12:00:00.000Z'),
    })).toMatchObject({ subtotal: 100, discountTotal: 0, total: 100 });
  });
});
