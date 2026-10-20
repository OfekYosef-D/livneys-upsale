import { describe, expect, it } from 'vitest';
import { applyPromotion, calculateOrderPricing, priceLine, resolveCatalogPricing, type PricingPromotion } from './engine';

const now = new Date('2026-06-27T10:00:00.000Z');

const target = {
  customerId: 'cust-south',
  routeId: 'route-south',
  priceListId: 'price-list-south',
};

const products = [
  { id: 'prod-herb', name: 'רוטב עשבים', category: 'רטבים', basePrice: 31, isActive: true, minQty: 1 },
  { id: 'prod-spread', name: 'ממרח חציל', category: 'ממרחים', basePrice: 28, isActive: true, minQty: 1 },
  { id: 'prod-hidden', name: 'לא פעיל', category: 'רטבים', basePrice: 99, isActive: false, minQty: 1 },
];

const priceListItems = [
  { productId: 'prod-herb', price: 30 },
  { productId: 'prod-spread', price: 28 },
  { productId: 'prod-hidden', price: 99 },
];

function promo(overrides: Partial<PricingPromotion> = {}): PricingPromotion {
  return {
    id: 'promo-week',
    title: 'מבצע השבוע',
    tag: '10% הנחה',
    description: 'הנחה ללקוחות דרום',
    effectType: 'PERCENT_OFF',
    discountValue: 10,
    buyQuantity: null,
    freeQuantity: null,
    priority: 10,
    startsAt: new Date('2026-06-20T00:00:00.000Z'),
    endsAt: new Date('2026-06-30T23:59:59.000Z'),
    isActive: true,
    productIds: ['prod-herb'],
    categories: [],
    customerIds: [],
    routeIds: ['route-south'],
    priceListIds: ['price-list-south'],
    ...overrides,
  };
}

describe('pricing engine', () => {
  it('returns safe domain errors for unavailable products and invalid quantities', () => {
    expect(() => calculateOrderPricing({
      target,
      products,
      priceListItems,
      items: [{ productId: 'prod-hidden', quantity: 1 }],
      promotions: [],
      now,
    })).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));

    expect(() => calculateOrderPricing({
      target,
      products: [{ ...products[0], minQty: 6 }],
      priceListItems,
      items: [{ productId: 'prod-herb', quantity: 2 }],
      promotions: [],
      now,
    })).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('resolves catalog prices from the customer price list and active eligible promotions', () => {
    const result = resolveCatalogPricing({
      target,
      products,
      priceListItems,
      promotions: [
        promo(),
        promo({ id: 'future', startsAt: new Date('2026-07-01T00:00:00.000Z'), priority: 99 }),
        promo({ id: 'wrong-route', routeIds: ['route-north'], priority: 99 }),
      ],
      now,
    });

    expect(result).toEqual([
      expect.objectContaining({
        productId: 'prod-herb',
        listPrice: 30,
        price: 27,
        promoLabel: '10% הנחה',
        promotion: expect.objectContaining({ id: 'promo-week' }),
      }),
      expect.objectContaining({
        productId: 'prod-spread',
        listPrice: 28,
        price: 28,
        promoLabel: undefined,
        promotion: null,
      }),
    ]);
  });

  it('chooses one promotion by priority, then savings, then earliest end date', () => {
    const result = calculateOrderPricing({
      target,
      products,
      priceListItems,
      items: [{ productId: 'prod-herb', quantity: 10 }],
      promotions: [
        promo({ id: 'lower-priority', tag: '₪8 הנחה', effectType: 'FIXED_AMOUNT_OFF', discountValue: 8, priority: 1 }),
        promo({ id: 'priority-small', tag: '₪4 הנחה', effectType: 'FIXED_AMOUNT_OFF', discountValue: 4, priority: 20 }),
        promo({ id: 'priority-large', tag: '₪5 הנחה', effectType: 'FIXED_AMOUNT_OFF', discountValue: 5, priority: 20 }),
      ],
      now,
    });

    expect(result.lines[0]).toEqual(
      expect.objectContaining({
        productId: 'prod-herb',
        listUnitPrice: 30,
        unitPrice: 25,
        discountTotal: 50,
        lineTotal: 250,
        promotionId: 'priority-large',
      }),
    );
    expect(result.subtotal).toBe(300);
    expect(result.discountTotal).toBe(50);
    expect(result.total).toBe(250);
  });

  it('calculates fixed price and buy-x-get-y discounts with line snapshots', () => {
    const fixedPrice = calculateOrderPricing({
      target,
      products,
      priceListItems,
      items: [{ productId: 'prod-spread', quantity: 3 }],
      promotions: [promo({ id: 'fixed-price', productIds: ['prod-spread'], routeIds: [], effectType: 'FIXED_UNIT_PRICE', discountValue: 20 })],
      now,
    });

    expect(fixedPrice.lines[0]).toEqual(
      expect.objectContaining({
        listUnitPrice: 28,
        unitPrice: 20,
        discountTotal: 24,
        lineTotal: 60,
        promotionSnapshot: expect.objectContaining({ effectType: 'FIXED_UNIT_PRICE' }),
      }),
    );

    const buyXGetY = calculateOrderPricing({
      target,
      products,
      priceListItems,
      items: [{ productId: 'prod-herb', quantity: 14 }],
      promotions: [promo({ effectType: 'BUY_X_GET_Y', discountValue: null, buyQuantity: 12, freeQuantity: 2 })],
      now,
    });

    expect(buyXGetY.lines[0]).toEqual(
      expect.objectContaining({
        listUnitPrice: 30,
        unitPrice: 30,
        discountTotal: 60,
        lineTotal: 360,
      }),
    );
  });

  it('rejects quantities that break the case multiple', () => {
    expect(() => calculateOrderPricing({
      target,
      products: [{ ...products[0], minQty: 6, orderMultiple: 6 }],
      priceListItems,
      items: [{ productId: 'prod-herb', quantity: 8 }],
      promotions: [],
      now,
    })).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('exposes the same per-line math the browser cart uses', () => {
    expect(applyPromotion({ effectType: 'PERCENT_OFF', discountValue: 150, buyQuantity: null, freeQuantity: null }, 10, 2))
      .toEqual({ unitPrice: 0, discountTotal: 20 });
    expect(applyPromotion({ effectType: 'FIXED_AMOUNT_OFF', discountValue: 50, buyQuantity: null, freeQuantity: null }, 10, 3))
      .toEqual({ unitPrice: 0, discountTotal: 30 });
    const display = priceLine({ productId: 'p', productName: 'P', listUnitPrice: 10, quantity: 3, promotion: { ...promo(), effectType: 'DISPLAY_ONLY' } });
    expect(display).toMatchObject({ lineTotal: 30, discountTotal: 0, promotionId: null, promotionSnapshot: null });
  });
});
