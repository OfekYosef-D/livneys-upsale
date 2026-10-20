import { describe, expect, it } from 'vitest';
import type { PricingPromotion } from '../pricing/engine';
import { buildDraftOrder, buildSubmittedOrder, formatManualOrderInternalNote, type OrderWriteContext } from './write';

const now = new Date('2026-10-17T10:00:00.000Z');

function context(overrides: Partial<OrderWriteContext> = {}): OrderWriteContext {
  return {
    customerId: 'cust-1',
    routeId: 'route-1',
    vatRatePercent: 18,
    schedule: { deliveryAt: new Date('2026-10-20T05:00:00.000Z'), cutoffAt: new Date('2026-10-18T15:00:00.000Z') },
    pricing: {
      target: { customerId: 'cust-1', routeId: 'route-1', priceListId: 'list-1' },
      products: [
        { id: 'jar', name: 'ממרח', category: 'ממרחים', basePrice: 20, isActive: true, minQty: 6, orderMultiple: 6 },
        { id: 'sauce', name: 'רוטב', category: 'רטבים', basePrice: 40, isActive: true, minQty: 1, orderMultiple: 1 },
      ],
      priceListItems: [{ productId: 'jar', price: 18 }],
      promotions: [],
    },
    ...overrides,
  };
}

const tenPercentOnSauce: PricingPromotion = {
  id: 'promo', title: 'מבצע', tag: '10%', description: 'הנחה', effectType: 'PERCENT_OFF', discountValue: 10,
  buyQuantity: null, freeQuantity: null, priority: 1, startsAt: null, endsAt: null, isActive: true,
  productIds: ['sauce'], categories: [], customerIds: [], routeIds: [], priceListIds: [],
};

describe('order snapshots', () => {
  it('snapshots price-list prices, totals, delivery window and the B2B declaration for customer orders', () => {
    const snapshot = buildSubmittedOrder({
      context: context(),
      items: [{ productId: 'jar', quantity: 24 }, { productId: 'sauce', quantity: 10 }],
      source: 'CUSTOMER',
      paymentTerm: 'NET_30',
      commercialTermsAccepted: true,
      notes: '  לפני 10  ',
      now,
    });

    expect(snapshot.lines.map((line) => [line.productId, line.unitPrice, line.lineTotal])).toEqual([['jar', 18, 432], ['sauce', 40, 400]]);
    expect(snapshot.order).toMatchObject({
      status: 'SUBMITTED',
      source: 'CUSTOMER',
      subtotal: 832,
      total: 832,
      vatTotal: 149.76,
      totalIncludingVat: 981.76,
      deliveryWindowStart: new Date('2026-10-20T05:00:00.000Z'),
      notes: 'לפני 10',
      commercialTermsAcceptedAt: now,
    });
  });

  it('applies promotions server-side and marks orders after the cut-off as special requests', () => {
    const snapshot = buildSubmittedOrder({
      context: context({ pricing: { ...context().pricing, promotions: [tenPercentOnSauce] } }),
      items: [{ productId: 'sauce', quantity: 20 }],
      source: 'ADMIN',
      paymentTerm: 'NET_30',
      now: new Date('2026-10-19T08:00:00.000Z'),
    });
    expect(snapshot.order).toMatchObject({ status: 'SPECIAL_REQUEST', discountTotal: 80, total: 720, commercialTermsVersion: null });
    expect(snapshot.lines[0].promotionSnapshot).toMatchObject({ id: 'promo' });
  });

  it('enforces the B2B declaration and the customer minimum (before the payment discount)', () => {
    const base = { context: context(), source: 'CUSTOMER' as const, paymentTerm: 'IMMEDIATE_OR_CASH' as const, now };
    expect(() => buildSubmittedOrder({ ...base, items: [{ productId: 'sauce', quantity: 20 }] })).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => buildSubmittedOrder({ ...base, commercialTermsAccepted: true, items: [{ productId: 'sauce', quantity: 5 }] }))
      .toThrow(expect.objectContaining({ message: expect.stringContaining('מינימום') }));
    // 700 before the 5% immediate-payment discount is enough.
    expect(buildSubmittedOrder({ ...base, commercialTermsAccepted: true, items: [{ productId: 'sauce', quantity: 18 }, { productId: 'jar', quantity: 0 }] }).order.total).toBe(684);
  });

  it('ignores products that are no longer sold and rejects an order that ends up empty', () => {
    expect(() => buildSubmittedOrder({
      context: context(),
      items: [{ productId: 'discontinued', quantity: 6 }],
      source: 'ADMIN',
      paymentTerm: 'NET_30',
      now,
    })).toThrow(expect.objectContaining({ message: expect.stringContaining('לפחות מוצר אחד') }));
  });

  it('builds drafts without a minimum and returns null for an empty cart', () => {
    expect(buildDraftOrder({ context: context(), items: [{ productId: 'sauce', quantity: 1 }], now })?.order).toMatchObject({ status: 'DRAFT', submittedAt: null, total: 40 });
    expect(buildDraftOrder({ context: context(), items: [], now })).toBeNull();
  });

  it('tags manual orders with the intake channel', () => {
    expect(formatManualOrderInternalNote({ intakeChannel: 'PHONE', note: ' התקשר בבוקר ' })).toBe('[manual-order:intake=PHONE] התקשר בבוקר');
    expect(formatManualOrderInternalNote({ intakeChannel: 'WHATSAPP' })).toBe('[manual-order:intake=WHATSAPP]');
  });
});
