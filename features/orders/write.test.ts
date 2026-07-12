import { describe, expect, it } from 'vitest';
import type { PricingPromotion } from '../pricing/engine';
import { buildSubmittedOrderPayload, formatManualOrderInternalNote } from './write';

const route = {
  id: 'route-south',
  isActive: true,
  nextDeliveryAt: new Date('2026-06-30T08:00:00.000Z'),
  nextCutoffAt: new Date('2026-06-29T15:00:00.000Z'),
};

const customer = {
  id: 'cust-001',
  routeId: 'route-south',
  priceListId: 'price-list-south',
  isActive: true,
};

const products = [
  {
    id: 'prod-a',
    name: 'Product A',
    category: 'Category A',
    basePrice: 12,
    isActive: true,
    minQty: 2,
  },
  {
    id: 'prod-b',
    name: 'Product B',
    category: 'Category B',
    basePrice: 7,
    isActive: true,
    minQty: 1,
  },
];

const priceListItems = [
  { productId: 'prod-a', price: 12 },
  { productId: 'prod-b', price: 7 },
];

const promotion: PricingPromotion = {
  id: 'promo-a',
  title: 'Promo A',
  tag: '25%',
  description: 'Discounted Product A',
  effectType: 'PERCENT_OFF',
  discountValue: 25,
  buyQuantity: null,
  freeQuantity: null,
  priority: 10,
  startsAt: null,
  endsAt: null,
  isActive: true,
  productIds: ['prod-a'],
  categories: [],
  customerIds: [],
  routeIds: [],
  priceListIds: ['price-list-south'],
};

describe('shared order write utilities', () => {
  it('builds submitted admin order payloads with price snapshots and cutoff status', () => {
    const result = buildSubmittedOrderPayload({
      context: {
        customer,
        route,
        products,
        priceListItems,
        promotions: [],
      },
      items: [
        { productId: 'prod-a', quantity: 3 },
        { productId: 'prod-b', quantity: 4 },
      ],
      source: 'ADMIN',
      now: new Date('2026-06-29T14:00:00.000Z'),
      notes: 'Customer asked for delivery confirmation.',
      internalNote: formatManualOrderInternalNote({
        intakeChannel: 'WHATSAPP',
        note: 'Sent by Shai.',
      }),
    });

    expect(result.order).toMatchObject({
      customerId: 'cust-001',
      routeId: 'route-south',
      status: 'SUBMITTED',
      source: 'ADMIN',
      subtotal: 64,
      discountTotal: 0,
      total: 64,
      notes: 'Customer asked for delivery confirmation.',
      internalNote: '[manual-order:intake=WHATSAPP] Sent by Shai.',
    });
    expect(result.lines).toEqual([
      {
        productId: 'prod-a',
        productName: 'Product A',
        quantity: 3,
        listUnitPrice: 12,
        unitPrice: 12,
        lineSubtotal: 36,
        discountTotal: 0,
        lineTotal: 36,
        promotionId: null,
        promotionSnapshot: null,
      },
      {
        productId: 'prod-b',
        productName: 'Product B',
        quantity: 4,
        listUnitPrice: 7,
        unitPrice: 7,
        lineSubtotal: 28,
        discountTotal: 0,
        lineTotal: 28,
        promotionId: null,
        promotionSnapshot: null,
      },
    ]);
  });

  it('applies eligible promotions and stores discount snapshots server-side', () => {
    const result = buildSubmittedOrderPayload({
      context: {
        customer,
        route,
        products,
        priceListItems,
        promotions: [promotion],
      },
      items: [{ productId: 'prod-a', quantity: 4 }],
      source: 'ADMIN',
      now: new Date('2026-06-29T14:00:00.000Z'),
    });

    expect(result.order).toMatchObject({
      subtotal: 48,
      discountTotal: 12,
      total: 36,
    });
    expect(result.lines[0]).toEqual(
      expect.objectContaining({
        listUnitPrice: 12,
        unitPrice: 9,
        lineSubtotal: 48,
        discountTotal: 12,
        lineTotal: 36,
        promotionId: 'promo-a',
        promotionSnapshot: expect.objectContaining({ id: 'promo-a', effectType: 'PERCENT_OFF' }),
      }),
    );
  });

  it('marks submitted orders after cutoff as special requests', () => {
    const result = buildSubmittedOrderPayload({
      context: { customer, route, products, priceListItems, promotions: [] },
      items: [{ productId: 'prod-a', quantity: 2 }],
      source: 'ADMIN',
      now: new Date('2026-06-29T16:00:00.000Z'),
    });

    expect(result.order.status).toBe('SPECIAL_REQUEST');
  });

  it('rejects inactive customers and routes before building order data', () => {
    expect(() =>
      buildSubmittedOrderPayload({
        context: {
          customer: { id: 'cust-inactive', routeId: 'route-south', priceListId: 'price-list-south', isActive: false },
          route,
          products,
          priceListItems,
          promotions: [],
        },
        items: [{ productId: 'prod-a', quantity: 2 }],
        source: 'ADMIN',
        now: new Date('2026-06-29T14:00:00.000Z'),
      }),
    ).toThrow('Customer is inactive');

    expect(() =>
      buildSubmittedOrderPayload({
        context: {
          customer,
          route: { ...route, isActive: false },
          products,
          priceListItems,
          promotions: [],
        },
        items: [{ productId: 'prod-a', quantity: 2 }],
        source: 'ADMIN',
        now: new Date('2026-06-29T14:00:00.000Z'),
      }),
    ).toThrow('Route is inactive');
  });

  it('drops unavailable products instead of failing when building submitted order payloads', () => {
    const result = buildSubmittedOrderPayload({
      context: { customer, route, products, priceListItems, promotions: [] },
      items: [
        { productId: 'prod-a', quantity: 2 },
        { productId: 'prod-disabled', quantity: 4 },
      ],
      source: 'ADMIN',
      now: new Date('2026-06-29T14:00:00.000Z'),
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.productId).toBe('prod-a');
  });
});
