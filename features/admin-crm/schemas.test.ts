import { describe, expect, it } from 'vitest';
import {
  activeToggleSchema,
  bulkCategoryPriceSchema,
  clonePriceListSchema,
  customerSchema,
  manualOrderSchema,
  priceListSchema,
  productSchema,
  promotionSchema,
  quickProductUpdateSchema,
  recommendationSchema,
  routeSchema,
} from './schemas';

const idempotencyKey = '8f82b072-99be-45e7-b1aa-2ca4d92fc8d2';

const validCustomer = {
  name: '  Cafe South  ',
  invoiceName: '',
  contact: 'Dana',
  email: '  DANA@EXAMPLE.COM ',
  phone: '050-1111111',
  accountingContactName: '',
  accountingEmail: '',
  accountingPhone: '',
  businessType: '',
  region: 'South',
  address: 'Industrial 4',
  deliveryConstraints: '',
  routeId: 'route-south',
  priceListId: 'price-list-standard',
  notes: '',
  statusLabel: '',
  isActive: true,
  emailEnabled: true,
  whatsappEnabled: false,
};

const validProduct = {
  sku: 'spr-185',
  name: 'Product',
  category: 'Spreads',
  description: '',
  basePrice: '16.9',
  unit: '185g jar',
  caseSize: '12 units per case',
  minQty: 6,
  orderMultiple: '6',
  imageUrl: '',
  assetImage: '',
  stockLabel: '',
  isActive: true,
};

const validRoute = {
  name: 'South',
  region: 'South',
  driver: '',
  opsContactName: '',
  opsContactPhone: '',
  deliveryWeekday: '2',
  cutoffWeekday: 1,
  cutoffTime: '18:00',
  nextDeliveryDate: '',
  isActive: true,
};

const basePromotion = {
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
};

const validManualOrder = {
  customerId: 'cust-001',
  idempotencyKey,
  vatRatePercent: '18',
  intakeChannel: 'PHONE',
  items: [{ productId: 'prod-a', quantity: '2' }],
};

function firstIssue(result: { success: boolean; error?: { issues: Array<{ message: string; path: PropertyKey[] }> } }) {
  expect(result.success).toBe(false);
  return result.error!.issues[0]!;
}

describe('customerSchema', () => {
  it('trims text, lowercases emails and turns empty optional fields into null', () => {
    expect(customerSchema.parse(validCustomer)).toEqual({
      name: 'Cafe South',
      invoiceName: null,
      contact: 'Dana',
      email: 'dana@example.com',
      phone: '050-1111111',
      accountingContactName: null,
      accountingEmail: null,
      accountingPhone: null,
      businessType: null,
      region: 'South',
      address: 'Industrial 4',
      deliveryConstraints: null,
      routeId: 'route-south',
      priceListId: 'price-list-standard',
      notes: null,
      statusLabel: null,
      isActive: true,
      emailEnabled: true,
      whatsappEnabled: false,
    });
  });

  it('allows customers without an email but rejects malformed emails and short phones', () => {
    expect(customerSchema.parse({ ...validCustomer, email: '' }).email).toBeNull();
    expect(customerSchema.safeParse({ ...validCustomer, email: 'not-an-email' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...validCustomer, accountingEmail: 'nope' }).success).toBe(false);
    expect(firstIssue(customerSchema.safeParse({ ...validCustomer, phone: '123' })).message).toBe('מספר טלפון לא תקין.');
  });

  it('requires a name, route and price list', () => {
    expect(firstIssue(customerSchema.safeParse({ ...validCustomer, name: '   ' })).message).toBe('שדה חובה.');
    expect(customerSchema.safeParse({ ...validCustomer, routeId: '' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...validCustomer, priceListId: undefined }).success).toBe(false);
  });
});

describe('productSchema', () => {
  it('uppercases the SKU, coerces numbers and nulls empty optional fields', () => {
    expect(productSchema.parse(validProduct)).toMatchObject({
      sku: 'SPR-185',
      basePrice: 16.9,
      minQty: 6,
      orderMultiple: 6,
      imageUrl: null,
      assetImage: null,
      stockLabel: null,
      description: null,
      prices: [],
    });
  });

  it('defaults the order multiple to 1', () => {
    const { orderMultiple: _omit, ...withoutMultiple } = validProduct;
    expect(productSchema.parse({ ...withoutMultiple, minQty: 5 }).orderMultiple).toBe(1);
  });

  it('accepts a minimum that is a multiple of the case size, or below it', () => {
    expect(productSchema.safeParse({ ...validProduct, minQty: 12, orderMultiple: 6 }).success).toBe(true);
    expect(productSchema.safeParse({ ...validProduct, minQty: 4, orderMultiple: 6 }).success).toBe(true);
  });

  it('rejects a minimum that does not align with the order multiple', () => {
    const issue = firstIssue(productSchema.safeParse({ ...validProduct, minQty: 8, orderMultiple: 6 }));
    expect(issue.path).toEqual(['minQty']);
    expect(issue.message).toBe('כמות המינימום צריכה להתאים לכפולת ההזמנה (למשל מינימום 6 עם כפולה 6).');
  });

  it('rejects zero prices, non-positive quantities and invalid image URLs', () => {
    expect(firstIssue(productSchema.safeParse({ ...validProduct, basePrice: 0 })).message).toBe('המחיר חייב להיות גדול מאפס.');
    expect(productSchema.safeParse({ ...validProduct, minQty: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, orderMultiple: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, imageUrl: 'not-a-url' }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, prices: [{ priceListId: 'list-a', price: -1 }] }).success).toBe(false);
  });

  it('coerces per-price-list prices', () => {
    expect(productSchema.parse({ ...validProduct, prices: [{ priceListId: 'list-a', price: '18.5' }] }).prices)
      .toEqual([{ priceListId: 'list-a', price: 18.5 }]);
  });
});

describe('quickProductUpdateSchema and bulkCategoryPriceSchema', () => {
  it('accepts a price-only or minimum-only quick update', () => {
    expect(quickProductUpdateSchema.parse({ id: 'prod-1', basePrice: '35' })).toEqual({ id: 'prod-1', basePrice: 35 });
    expect(quickProductUpdateSchema.parse({ id: 'prod-1', minQty: '12' })).toEqual({ id: 'prod-1', minQty: 12 });
  });

  it('requires at least one field to change', () => {
    expect(firstIssue(quickProductUpdateSchema.safeParse({ id: 'prod-1' })).message).toBe('יש לעדכן מחיר או כמות מינימום.');
  });

  it('accepts a category-wide price and rejects a non-positive one', () => {
    expect(bulkCategoryPriceSchema.parse({ category: ' ממרחים ', price: '35' })).toEqual({ category: 'ממרחים', price: 35 });
    expect(bulkCategoryPriceSchema.safeParse({ category: 'ממרחים', price: 0 }).success).toBe(false);
  });
});

describe('routeSchema', () => {
  it('coerces weekdays and treats an empty delivery date as no override', () => {
    expect(routeSchema.parse(validRoute)).toMatchObject({
      deliveryWeekday: 2,
      cutoffWeekday: 1,
      cutoffTime: '18:00',
      nextDeliveryDate: null,
      driver: null,
    });
  });

  it('keeps an explicit YYYY-MM-DD delivery date', () => {
    expect(routeSchema.parse({ ...validRoute, nextDeliveryDate: '2026-11-03' }).nextDeliveryDate).toBe('2026-11-03');
  });

  it('rejects weekdays outside 0-6, invalid times and invalid dates', () => {
    expect(routeSchema.safeParse({ ...validRoute, deliveryWeekday: 7 }).success).toBe(false);
    expect(routeSchema.safeParse({ ...validRoute, cutoffWeekday: -1 }).success).toBe(false);
    expect(firstIssue(routeSchema.safeParse({ ...validRoute, cutoffTime: '24:00' })).message).toBe('שעה לא תקינה.');
    expect(routeSchema.safeParse({ ...validRoute, cutoffTime: '9:00' }).success).toBe(false);
    expect(firstIssue(routeSchema.safeParse({ ...validRoute, nextDeliveryDate: '03/11/2026' })).message).toBe('תאריך לא תקין.');
  });
});

describe('promotionSchema', () => {
  it('parses a percent-off promotion with empty optional numbers and dates', () => {
    expect(promotionSchema.parse(basePromotion)).toMatchObject({
      effectType: 'PERCENT_OFF',
      discountValue: 10,
      buyQuantity: null,
      freeQuantity: null,
      startsAt: null,
      endsAt: null,
      productIds: ['prod-a'],
      priceListIds: ['price-list-standard'],
    });
  });

  it('splits comma-separated target lists', () => {
    expect(promotionSchema.parse({ ...basePromotion, categories: 'ממרחים, טחינה ,' }).categories).toEqual(['ממרחים', 'טחינה']);
  });

  it('defaults to a display-only promotion that needs no discount', () => {
    const { effectType: _effect, discountValue: _discount, ...rest } = basePromotion;
    expect(promotionSchema.parse(rest)).toMatchObject({ effectType: 'DISPLAY_ONLY', discountValue: null });
  });

  it('requires the end date to be after the start date', () => {
    const issue = firstIssue(promotionSchema.safeParse({ ...basePromotion, startsAt: '2026-07-10T00:00', endsAt: '2026-07-01T00:00' }));
    expect(issue.path).toEqual(['endsAt']);
    expect(issue.message).toBe('תאריך הסיום חייב להיות אחרי תאריך ההתחלה.');
  });

  it('requires a discount value for discounting effect types', () => {
    const issue = firstIssue(promotionSchema.safeParse({ ...basePromotion, effectType: 'FIXED_AMOUNT_OFF', discountValue: '' }));
    expect(issue.path).toEqual(['discountValue']);
    expect(issue.message).toBe('יש להזין ערך הנחה או מחיר לסוג מבצע זה.');
  });

  it('caps percent discounts at 100', () => {
    expect(firstIssue(promotionSchema.safeParse({ ...basePromotion, discountValue: 120 })).message).toBe('אחוז הנחה חייב להיות בין 0 ל-100.');
    expect(promotionSchema.safeParse({ ...basePromotion, discountValue: 100 }).success).toBe(true);
  });

  it('requires both quantities for buy-X-get-Y', () => {
    const bundle = { ...basePromotion, effectType: 'BUY_X_GET_Y', discountValue: '' };
    const issue = firstIssue(promotionSchema.safeParse({ ...bundle, buyQuantity: 0, freeQuantity: 2 }));
    expect(issue.path).toEqual(['buyQuantity']);
    expect(issue.message).toBe('במבצע "קנה X קבל Y" יש להזין את שתי הכמויות.');
    expect(promotionSchema.parse({ ...bundle, buyQuantity: 3, freeQuantity: 1 })).toMatchObject({ buyQuantity: 3, freeQuantity: 1 });
  });
});

describe('price list, recommendation and toggle schemas', () => {
  it('coerces price list prices and requires at least one', () => {
    expect(priceListSchema.parse({
      name: 'South',
      description: '',
      isDefault: false,
      prices: [{ productId: 'prod-a', price: '18.5' }, { productId: 'prod-b', price: 22 }],
    })).toEqual({
      name: 'South',
      description: null,
      isDefault: false,
      prices: [{ productId: 'prod-a', price: 18.5 }, { productId: 'prod-b', price: 22 }],
    });
    expect(priceListSchema.safeParse({ name: 'Empty', isDefault: false, prices: [] }).success).toBe(false);
  });

  it('requires a name when cloning a price list', () => {
    expect(clonePriceListSchema.safeParse({ id: 'list-a', name: ' ' }).success).toBe(false);
  });

  it('nulls an empty recommendation reason', () => {
    expect(recommendationSchema.parse({ customerId: 'cust-001', productId: 'prod-a', reason: '', isActive: true }).reason).toBeNull();
  });

  it('requires a boolean active flag', () => {
    expect(activeToggleSchema.safeParse({ id: 'x', isActive: 'true' }).success).toBe(false);
  });
});

describe('manualOrderSchema', () => {
  it('accepts a manual order with a UUID idempotency key and coerces numbers', () => {
    expect(manualOrderSchema.parse(validManualOrder)).toEqual({
      customerId: 'cust-001',
      idempotencyKey,
      vatRatePercent: 18,
      intakeChannel: 'PHONE',
      items: [{ productId: 'prod-a', quantity: 2 }],
      notes: null,
      internalNote: null,
    });
  });

  it('requires a UUID idempotency key and a VAT rate', () => {
    expect(manualOrderSchema.safeParse({ ...validManualOrder, idempotencyKey: 'invalid' }).success).toBe(false);
    expect(manualOrderSchema.safeParse({ ...validManualOrder, idempotencyKey: undefined }).success).toBe(false);
    expect(manualOrderSchema.safeParse({ ...validManualOrder, vatRatePercent: undefined }).success).toBe(false);
  });

  it('requires items with positive quantities and a known intake channel', () => {
    expect(firstIssue(manualOrderSchema.safeParse({ ...validManualOrder, items: [] })).message).toBe('בחרו לפחות מוצר אחד.');
    expect(manualOrderSchema.safeParse({ ...validManualOrder, items: [{ productId: 'prod-a', quantity: 0 }] }).success).toBe(false);
    expect(manualOrderSchema.safeParse({ ...validManualOrder, intakeChannel: 'EMAIL' }).success).toBe(false);
  });
});
