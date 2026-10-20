import { beforeEach, describe, expect, it } from 'vitest';
import { createPrismaMock } from '@/test/prisma-mock';
import type { TransactionClient } from '@/lib/transactions';
import { cancelDraftOrder, persistDraftOrder, persistSubmittedOrder } from './persistence';
import type { OrderSnapshot } from './write';

const window = new Date('2026-10-20T05:00:00.000Z');
const db = createPrismaMock();
const tx = db as unknown as TransactionClient;

const snapshot: OrderSnapshot = {
  order: {
    customerId: 'cust-1', routeId: 'route-1', status: 'SUBMITTED', source: 'CUSTOMER', deliveryWindowStart: window,
    deadlineAt: window, submittedAt: window, notes: null, internalNote: null, paymentTerm: 'NET_30',
    commercialTermsVersion: 'v1', commercialTermsAcceptedAt: window, subtotal: 100, discountTotal: 0,
    paymentDiscountPercent: 0, paymentDiscountTotal: 0, total: 100, vatRatePercent: 18, vatTotal: 18, totalIncludingVat: 118,
  },
  lines: [{
    productId: 'p1', productName: 'P', quantity: 1, listUnitPrice: 100, unitPrice: 100, lineSubtotal: 100,
    discountTotal: 0, lineTotal: 100, promotionId: null, promotionSnapshot: null,
  }],
};

const persisted = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1', orderNumber: 1001, status: 'SUBMITTED', routeId: 'route-1', customerId: 'cust-1', deliveryWindowStart: window, revision: 1, ...overrides,
});

describe('order persistence', () => {
  beforeEach(() => db.$reset());

  it('replays an existing order for the same idempotency key without writing', async () => {
    db.order.findUnique.mockResolvedValue(persisted());
    await expect(persistSubmittedOrder(tx, { snapshot, idempotencyKey: 'key', replaceDraft: true }))
      .resolves.toEqual({ order: persisted(), replayed: true });
    expect(db.order.create).not.toHaveBeenCalled();
  });

  it('refuses a key that was used for another customer or delivery window', async () => {
    db.order.findUnique.mockResolvedValue(persisted({ customerId: 'someone-else' }));
    await expect(persistSubmittedOrder(tx, { snapshot, idempotencyKey: 'key', replaceDraft: true }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT' });
  });

  it('allows one order per delivery window and points the user to the existing one', async () => {
    db.order.findUnique.mockResolvedValue(null);
    db.order.findFirst.mockResolvedValue(persisted({ id: 'existing', orderNumber: 1000 }));
    await expect(persistSubmittedOrder(tx, { snapshot, idempotencyKey: 'key', replaceDraft: true }))
      .rejects.toMatchObject({ code: 'ACTIVE_ORDER_EXISTS', details: { orderId: 'existing', orderNumber: 1000 } });
  });

  it('converts the customer draft in place with an optimistic revision check', async () => {
    db.order.findUnique.mockResolvedValue(null);
    db.order.findFirst.mockResolvedValue(persisted({ id: 'draft', status: 'DRAFT', revision: 4 }));
    db.order.updateMany.mockResolvedValue({ count: 1 });
    db.order.findUniqueOrThrow.mockResolvedValue(persisted({ id: 'draft' }));

    await expect(persistSubmittedOrder(tx, { snapshot, idempotencyKey: 'key', replaceDraft: true })).resolves.toMatchObject({ replayed: false });
    expect(db.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'draft', status: 'DRAFT', revision: 4 } }));
    expect(db.orderLine.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'draft' } });
    expect(db.orderLine.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ orderId: 'draft', productId: 'p1' })] });
  });

  it('reports a concurrent draft change as a retryable stale version', async () => {
    db.order.findUnique.mockResolvedValue(null);
    db.order.findFirst.mockResolvedValue(persisted({ status: 'DRAFT' }));
    db.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(persistSubmittedOrder(tx, { snapshot, idempotencyKey: 'key', replaceDraft: true })).rejects.toMatchObject({ code: 'STALE_VERSION' });
  });

  it('creates a new order with its lines when the window is free', async () => {
    db.order.findUnique.mockResolvedValue(null);
    db.order.findFirst.mockResolvedValue(null);
    db.order.create.mockResolvedValue(persisted());
    await persistSubmittedOrder(tx, { snapshot, idempotencyKey: 'key', replaceDraft: false });
    expect(db.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idempotencyKey: 'key', lines: { create: [expect.objectContaining({ productId: 'p1' })] } }),
    }));
  });

  it('never overwrites a placed order with a draft, and cancels an emptied draft', async () => {
    db.order.findFirst.mockResolvedValue(persisted({ status: 'APPROVED' }));
    await expect(persistDraftOrder(tx, snapshot)).rejects.toMatchObject({ code: 'ACTIVE_ORDER_EXISTS' });

    db.order.findFirst.mockResolvedValue(persisted({ status: 'DRAFT', revision: 2 }));
    db.order.updateMany.mockResolvedValue({ count: 1 });
    await expect(cancelDraftOrder(tx, 'cust-1', window)).resolves.toBe(true);
    expect(db.order.updateMany).toHaveBeenCalledWith({ where: { id: 'order-1', status: 'DRAFT', revision: 2 }, data: { status: 'CANCELLED', revision: { increment: 1 } } });
  });
});
