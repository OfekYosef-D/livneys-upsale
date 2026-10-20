import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionClient } from '@/lib/transactions';
import { createPrismaMock } from '@/test/prisma-mock';
import { approveAdditionRequest, persistPendingAdditionRequest, rejectAdditionRequest } from './persistence';
import type { OrderAdditionSnapshot } from './pricing';

const db = createPrismaMock();
const tx = db as unknown as TransactionClient;
const audit = vi.fn();
const now = new Date('2026-10-17T10:00:00.000Z');

const snapshot: OrderAdditionSnapshot = {
  subtotal: 100, discountTotal: 0, paymentDiscountPercent: 0, paymentDiscountTotal: 0, total: 100, vatRatePercent: 18, vatTotal: 18, totalIncludingVat: 118,
  lines: [{ productId: 'p1', productName: 'P', quantity: 1, listUnitPrice: 100, unitPrice: 100, lineSubtotal: 100, discountTotal: 0, lineTotal: 100, promotionId: null, promotionSnapshot: null }],
};

const baseInput = { orderId: 'order-1', customerId: 'cust-1', paymentTerm: 'NET_30' as const, idempotencyKey: 'key', snapshot, now, actorUserId: 'user-1', audit };

describe('order addition persistence', () => {
  beforeEach(() => {
    db.$reset();
    audit.mockReset();
  });

  it('replays a repeated submit and refuses a key reused for another order', async () => {
    db.orderAdditionRequest.findFirst.mockResolvedValueOnce({ id: 'req-1', orderId: 'order-1', customerId: 'cust-1' });
    await expect(persistPendingAdditionRequest(tx, baseInput)).resolves.toMatchObject({ replayed: true });

    db.orderAdditionRequest.findFirst.mockResolvedValueOnce({ id: 'req-1', orderId: 'other', customerId: 'cust-1' });
    await expect(persistPendingAdditionRequest(tx, baseInput)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT' });
  });

  it('refuses additions once the order is packed', async () => {
    db.orderAdditionRequest.findFirst.mockResolvedValue(null);
    db.order.findUnique.mockResolvedValue({ customerId: 'cust-1', status: 'PACKED', revision: 1 });
    await expect(persistPendingAdditionRequest(tx, baseInput)).rejects.toMatchObject({ code: 'ORDER_LOCKED' });
  });

  it('edits the single open request instead of creating a second one', async () => {
    db.orderAdditionRequest.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'req-open', revision: 2 });
    db.order.findUnique.mockResolvedValue({ customerId: 'cust-1', status: 'APPROVED', revision: 5 });
    db.orderAdditionRequest.updateMany.mockResolvedValue({ count: 1 });
    db.orderAdditionRequest.findUniqueOrThrow.mockResolvedValue({ id: 'req-open', status: 'PENDING' });

    await expect(persistPendingAdditionRequest(tx, baseInput)).resolves.toMatchObject({ replayed: false, request: { id: 'req-open' } });
    expect(db.orderAdditionRequest.create).not.toHaveBeenCalled();
    expect(db.orderAdditionLine.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ requestId: 'req-open', productId: 'p1' })] });
    expect(audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'ORDER_ADDITION_SUBMITTED', after: { edited: true, totalIncludingVat: 118 } }));
  });

  it('approves once: adds totals and lines to the order, and replays are no-ops', async () => {
    db.orderAdditionRequest.findUnique.mockResolvedValue({
      id: 'req-1', orderId: 'order-1', customerId: 'cust-1', status: 'PENDING', revision: 1,
      subtotal: 100, discountTotal: 0, paymentDiscountTotal: 0, total: 100, vatTotal: 18, totalIncludingVat: 118,
      order: { status: 'APPROVED', revision: 7 },
      lines: [{ id: 'line-1', productId: 'p1', productName: 'P', quantity: 1, listUnitPrice: 100, unitPrice: 100, lineSubtotal: 100, discountTotal: 0, lineTotal: 100, promotionId: null, promotionSnapshot: null }],
    });
    db.order.updateMany.mockResolvedValue({ count: 1 });
    db.orderAdditionRequest.updateMany.mockResolvedValue({ count: 1 });

    await expect(approveAdditionRequest(tx, { requestId: 'req-1', reviewerUserId: 'admin', now, audit })).resolves.toEqual({ orderId: 'order-1', customerId: 'cust-1', replayed: false });
    expect(db.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'order-1', revision: 7 }),
      data: expect.objectContaining({ totalIncludingVat: { increment: 118 }, revision: { increment: 1 } }),
    }));
    expect(db.orderLine.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ additionRequestLineId: 'line-1' })], skipDuplicates: true }));

    db.orderAdditionRequest.findUnique.mockResolvedValue({ id: 'req-1', orderId: 'order-1', customerId: 'cust-1', status: 'APPROVED' });
    db.order.updateMany.mockClear();
    await expect(approveAdditionRequest(tx, { requestId: 'req-1', reviewerUserId: 'admin', now, audit })).resolves.toMatchObject({ replayed: true });
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a pending request with a reason and leaves the order untouched', async () => {
    db.orderAdditionRequest.findUnique.mockResolvedValue({ id: 'req-1', orderId: 'order-1', customerId: 'cust-1', status: 'PENDING', revision: 1 });
    db.orderAdditionRequest.updateMany.mockResolvedValue({ count: 1 });

    await rejectAdditionRequest(tx, { requestId: 'req-1', reviewerUserId: 'admin', reason: 'אזל מהמלאי', now, audit });
    expect(db.orderAdditionRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED', rejectionReason: 'אזל מהמלאי' }) }));
    expect(db.order.updateMany).not.toHaveBeenCalled();

    db.orderAdditionRequest.findUnique.mockResolvedValue({ id: 'req-1', orderId: 'order-1', customerId: 'cust-1', status: 'APPROVED', revision: 2 });
    await expect(rejectAdditionRequest(tx, { requestId: 'req-1', reviewerUserId: 'admin', reason: 'x', now, audit })).rejects.toMatchObject({ code: 'ORDER_LOCKED' });
  });
});
