import { describe, expect, it } from 'vitest';
import {
  customerMutationSchema,
  manualOrderMutationSchema,
  priceListMutationSchema,
  productMutationSchema,
  promotionMutationSchema,
  recommendationMutationSchema,
  routeMutationSchema,
} from './schemas';

describe('admin CRM schemas', () => {
  it('normalizes valid customer input and notification preferences', () => {
    const parsed = customerMutationSchema.parse({
      name: '  Cafe South  ',
      contact: 'Dana',
      email: 'DANA@EXAMPLE.COM',
      phone: '050-1111111',
      region: 'South',
      address: 'Industrial 4',
      routeId: 'route-south',
      priceListId: 'price-list-standard',
      notes: '',
      statusLabel: '',
      isActive: true,
      emailEnabled: true,
      whatsappEnabled: false,
    });

    expect(parsed).toMatchObject({
      name: 'Cafe South',
      email: 'dana@example.com',
      notes: null,
      statusLabel: null,
      emailEnabled: true,
      whatsappEnabled: false,
    });
  });

  it('rejects invalid product prices, quantities, and image URLs', () => {
    expect(() =>
      productMutationSchema.parse({
        sku: 'SKU-1',
        name: 'Product',
        category: 'Category',
        basePrice: 0,
        unit: 'unit',
        caseSize: 'case',
        minQty: 0,
        imageUrl: 'not-a-url',
        isActive: true,
      }),
    ).toThrow();
  });

  it('rejects route cutoff dates after delivery dates', () => {
    expect(() =>
      routeMutationSchema.parse({
        name: 'South',
        region: 'South',
        driver: '',
        opsContactName: '',
        opsContactPhone: '',
        deliveryWeekday: 2,
        cutoffWeekday: 1,
        cutoffTime: '18:00',
        nextDeliveryAt: '2026-06-30T08:00:00.000Z',
        nextCutoffAt: '2026-07-01T08:00:00.000Z',
        isActive: true,
      }),
    ).toThrow();
  });

  it('rejects invalid promotion date ranges', () => {
    expect(() =>
      promotionMutationSchema.parse({
        title: 'Promo',
        tag: 'New',
        description: 'Try it',
        productId: 'prod-a',
        startsAt: '2026-07-10T00:00:00.000Z',
        endsAt: '2026-07-01T00:00:00.000Z',
        isActive: true,
      }),
    ).toThrow();
  });

  it('validates real promotion discount fields by effect type', () => {
    expect(
      promotionMutationSchema.parse({
        title: 'Promo',
        tag: '10%',
        description: 'Percent discount',
        effectType: 'PERCENT_OFF',
        discountValue: 10,
        buyQuantity: '',
        freeQuantity: '',
        priority: 5,
        productIds: ['prod-a'],
        categories: [],
        customerIds: [],
        routeIds: [],
        priceListIds: ['price-list-standard'],
        startsAt: '',
        endsAt: '',
        isActive: true,
      }),
    ).toMatchObject({
      effectType: 'PERCENT_OFF',
      discountValue: 10,
      productIds: ['prod-a'],
      priceListIds: ['price-list-standard'],
    });

    expect(() =>
      promotionMutationSchema.parse({
        title: 'Bad bundle',
        tag: 'Bundle',
        description: 'Invalid bundle',
        effectType: 'BUY_X_GET_Y',
        discountValue: '',
        buyQuantity: 0,
        freeQuantity: 2,
        priority: 0,
        productIds: ['prod-a'],
        categories: [],
        customerIds: [],
        routeIds: [],
        priceListIds: [],
        startsAt: '',
        endsAt: '',
        isActive: true,
      }),
    ).toThrow();
  });

  it('validates price list edits with product prices', () => {
    const parsed = priceListMutationSchema.parse({
      name: 'South',
      description: '',
      isDefault: false,
      prices: [
        { productId: 'prod-a', price: '18.5' },
        { productId: 'prod-b', price: 22 },
      ],
    });

    expect(parsed).toMatchObject({
      name: 'South',
      description: null,
      prices: [
        { productId: 'prod-a', price: 18.5 },
        { productId: 'prod-b', price: 22 },
      ],
    });
  });

  it('validates manual recommendations without building an engine', () => {
    const parsed = recommendationMutationSchema.parse({
      customerId: 'cust-001',
      productId: 'prod-a',
      reason: '',
      isActive: true,
    });

    expect(parsed.reason).toBeNull();
  });

  it('requires manual orders to have positive quantities and known intake channels', () => {
    expect(() =>
      manualOrderMutationSchema.parse({
        customerId: 'cust-001',
        items: [{ productId: 'prod-a', quantity: 0 }],
        intakeChannel: 'EMAIL',
      }),
    ).toThrow();
  });
});
