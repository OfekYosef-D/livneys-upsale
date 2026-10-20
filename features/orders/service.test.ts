import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMock } from '@/test/prisma-mock';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());

const { prisma } = await import('@/lib/db');
const { changeOrderStatus, saveDraftOrder, submitOrder } = await import('./service');
const db = asMock(prisma);

const deliveryAt = new Date('2026-10-20T05:00:00.000Z');
const audit = vi.fn();

function customerRow() {
  return {
    id: 'cust-1', isActive: true, routeId: 'route-1', priceListId: 'list-1',
    route: { id: 'route-1', isActive: true, nextDeliveryAt: deliveryAt, nextCutoffAt: new Date('2026-10-18T15:00:00.000Z'), deliveryWeekday: 2, cutoffWeekday: 0, cutoffTime: '18:00' },
    priceList: {
      items: [{ productId: 'p1', price: 100, product: { id: 'p1', name: 'P', category: 'C', basePrice: 100, isActive: true, minQty: 1, orderMultiple: 1 } }],
    },
  };
}

const persistedOrder = { id: 'order-1', orderNumber: 1001, status: 'SUBMITTED', routeId: 'route-1', customerId: 'cust-1', deliveryWindowStart: deliveryAt, revision: 1 };

describe('order service', () => {
  beforeEach(() => {
    db.$reset();
    audit.mockReset();
    db.customer.findUnique.mockResolvedValue(customerRow());
    db.promotion.findMany.mockResolvedValue([]);
    db.taxRate.findFirst.mockResolvedValue({ id: 'vat', ratePercent: 18 });
  });

  it('returns a replay before recalculating anything', async () => {
    db.order.findFirst.mockResolvedValue({ id: 'order-1', orderNumber: 1001, status: 'SUBMITTED' });
    await expect(submitOrder({
      customerId: 'cust-1', items: [{ productId: 'p1', quantity: 7 }], source: 'ADMIN', idempotencyKey: 'k', paymentTerm: 'NET_30',
      actor: { userId: 'admin', audit }, now: new Date('2026-10-17T10:00:00.000Z'),
    })).resolves.toEqual({ orderId: 'order-1', orderNumber: 1001, status: 'SUBMITTED', replayed: true });
    expect(db.customer.findUnique).not.toHaveBeenCalled();
  });

  it('persists a new order, audits it and records legal acceptance for customer orders', async () => {
    db.order.findFirst.mockResolvedValue(null);
    db.order.findUnique.mockResolvedValue(null);
    db.order.create.mockResolvedValue(persistedOrder);

    const result = await submitOrder({
      customerId: 'cust-1', items: [{ productId: 'p1', quantity: 7 }], source: 'CUSTOMER', idempotencyKey: 'k', paymentTerm: 'NET_30',
      commercialTermsAccepted: true, expectedVatRatePercent: 18, expectedLegalDocumentSetVersion: (await import('../legal/documents')).LEGAL_DOCUMENT_SET_VERSION,
      actor: { userId: 'user-1', audit }, now: new Date('2026-10-17T10:00:00.000Z'),
    });

    expect(result).toEqual({ orderId: 'order-1', orderNumber: 1001, status: 'SUBMITTED', replayed: false });
    expect(db.legalAcceptance.createMany).toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORDER_SUBMITTED', entityId: 'order-1' }));
  });

  it('returns the order committed by a concurrent identical submit instead of failing', async () => {
    db.order.findFirst.mockResolvedValueOnce(null).mockResolvedValue(null);
    db.order.findUnique.mockResolvedValueOnce(null).mockResolvedValue(persistedOrder);
    db.$transaction.mockRejectedValueOnce(Object.assign(new Error('serialization failure'), { code: 'P2034' }));

    await expect(submitOrder({
      customerId: 'cust-1', items: [{ productId: 'p1', quantity: 7 }], source: 'ADMIN', idempotencyKey: 'k', paymentTerm: 'NET_30',
      actor: { userId: 'admin', audit }, now: new Date('2026-10-17T10:00:00.000Z'),
    })).resolves.toMatchObject({ orderId: 'order-1', replayed: true });
  });

  it('rejects a stale VAT quote from an old review screen', async () => {
    db.order.findFirst.mockResolvedValue(null);
    await expect(submitOrder({
      customerId: 'cust-1', items: [{ productId: 'p1', quantity: 7 }], source: 'ADMIN', idempotencyKey: 'k', paymentTerm: 'NET_30',
      expectedVatRatePercent: 17, actor: { userId: 'admin', audit },
    })).rejects.toMatchObject({ code: 'STALE_VERSION' });
  });

  it('fails clearly when the customer route is inactive', async () => {
    db.customer.findUnique.mockResolvedValue({ ...customerRow(), route: { ...customerRow().route, isActive: false } });
    await expect(saveDraftOrder('cust-1', [{ productId: 'p1', quantity: 1 }])).rejects.toMatchObject({ code: 'DELIVERY_UNAVAILABLE' });
  });

  it('cancels the draft when the cart is emptied', async () => {
    db.order.findFirst.mockResolvedValue({ ...persistedOrder, status: 'DRAFT' });
    db.order.updateMany.mockResolvedValue({ count: 1 });
    await expect(saveDraftOrder('cust-1', [], new Date('2026-10-17T10:00:00.000Z'))).resolves.toEqual({ orderId: null });
    expect(db.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CANCELLED', revision: { increment: 1 } } }));
  });

  it('blocks packing while an addition request awaits review, and audits allowed transitions', async () => {
    db.order.findUnique.mockResolvedValue({ id: 'order-1', status: 'APPROVED', revision: 3, customerId: 'cust-1', additionRequests: [{ id: 'a1' }] });
    await expect(changeOrderStatus({ orderId: 'order-1', status: 'PACKED', audit })).rejects.toMatchObject({ code: 'ORDER_LOCKED' });

    db.order.findUnique.mockResolvedValue({ id: 'order-1', status: 'SUBMITTED', revision: 3, customerId: 'cust-1', additionRequests: [] });
    db.order.updateMany.mockResolvedValue({ count: 1 });
    await expect(changeOrderStatus({ orderId: 'order-1', status: 'APPROVED', audit })).resolves.toEqual({ orderId: 'order-1', customerId: 'cust-1', status: 'APPROVED' });
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORDER_STATUS_CHANGED', before: { status: 'SUBMITTED' }, after: { status: 'APPROVED' } }));
  });
});
