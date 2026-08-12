import { beforeEach, describe, expect, it, vi } from 'vitest';
import { approveAdditionRequest, packOrderSafely, persistPendingAdditionRequest, rejectAdditionRequest } from './persistence';

function makeTx() {
  return {
    orderAdditionRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    orderAdditionLine: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    orderLine: {
      createMany: vi.fn(),
    },
    orderActivity: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

const snapshot = {
  subtotal: 200,
  discountTotal: 0,
  paymentDiscountPercent: 5,
  paymentDiscountTotal: 10,
  total: 190,
  vatRatePercent: 18,
  vatTotal: 34.2,
  totalIncludingVat: 224.2,
  lines: [{
    productId: 'product-001',
    productName: 'טחינה',
    quantity: 2,
    listUnitPrice: 100,
    unitPrice: 100,
    lineSubtotal: 200,
    discountTotal: 0,
    lineTotal: 200,
    promotionId: null,
    promotionSnapshot: null,
  }],
};

describe('order addition persistence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the existing pending request instead of creating a second open request', async () => {
    const tx = makeTx();
    tx.orderAdditionRequest.findUnique.mockResolvedValue(null);
    tx.order.findUnique.mockResolvedValue({ id: 'order-001', customerId: 'cust-001', status: 'APPROVED', revision: 7 });
    tx.orderAdditionRequest.findFirst.mockResolvedValue({ id: 'request-001', revision: 3, orderId: 'order-001', customerId: 'cust-001' });
    tx.orderAdditionRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.orderAdditionRequest.findUniqueOrThrow.mockResolvedValue({ id: 'request-001', status: 'PENDING', revision: 4 });

    const result = await persistPendingAdditionRequest(tx as never, {
      orderId: 'order-001',
      customerId: 'cust-001',
      orderRevision: 7,
      paymentTerm: 'IMMEDIATE_OR_CASH',
      idempotencyKey: 'mutation-002',
      snapshot,
      now: new Date('2026-08-11T12:00:00.000Z'),
    });

    expect(result.replayed).toBe(false);
    expect(tx.orderAdditionRequest.create).not.toHaveBeenCalled();
    expect(tx.orderAdditionLine.deleteMany).toHaveBeenCalledWith({ where: { requestId: 'request-001' } });
    expect(tx.orderAdditionLine.createMany).toHaveBeenCalledTimes(1);
    expect(tx.orderActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: 'order-001', additionRequestId: 'request-001', action: 'ADDITION_SUBMITTED' }),
    });
  });

  it('rechecks the order lock inside the write transaction', async () => {
    const tx = makeTx();
    tx.order.findUnique.mockResolvedValue({ id: 'order-001', customerId: 'cust-001', status: 'PACKED', revision: 8 });

    await expect(persistPendingAdditionRequest(tx as never, {
      orderId: 'order-001', customerId: 'cust-001', orderRevision: 7,
      paymentTerm: 'NET_30', idempotencyKey: 'mutation-003', snapshot, now: new Date(),
    })).rejects.toMatchObject({ code: 'ORDER_LOCKED' });
    expect(tx.orderAdditionRequest.create).not.toHaveBeenCalled();
  });

  it('packs only when the serializable transaction sees no pending addition', async () => {
    const tx = makeTx();
    tx.order.findUnique.mockResolvedValue({
      id: 'order-001', status: 'APPROVED', revision: 7, customerId: 'cust-001', routeId: 'route-001', additionRequests: [],
    });
    tx.order.updateMany.mockResolvedValue({ count: 1 });
    tx.order.findUniqueOrThrow.mockResolvedValue({ id: 'order-001', status: 'PACKED', customerId: 'cust-001', routeId: 'route-001' });

    await expect(packOrderSafely(tx as never, 'order-001')).resolves.toMatchObject({ status: 'PACKED' });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-001', status: 'APPROVED', revision: 7 },
      data: { status: 'PACKED', revision: { increment: 1 } },
    });
  });

  it('approves a pending request once and appends its snapshotted lines', async () => {
    const tx = makeTx();
    tx.orderAdditionRequest.findUnique.mockResolvedValue({
      id: 'request-001', status: 'PENDING', revision: 2, customerId: 'cust-001',
      subtotal: 200, discountTotal: 0, paymentDiscountTotal: 10, total: 190,
      vatTotal: 34.2, totalIncludingVat: 224.2,
      order: { id: 'order-001', status: 'APPROVED', revision: 7 },
      lines: snapshot.lines.map((line) => ({ id: 'addition-line-001', ...line })),
    });
    tx.order.updateMany.mockResolvedValue({ count: 1 });
    tx.orderAdditionRequest.updateMany.mockResolvedValue({ count: 1 });

    const result = await approveAdditionRequest(tx as never, {
      requestId: 'request-001', reviewerUserId: 'admin-001', now: new Date('2026-08-11T13:00:00.000Z'),
    });

    expect(result).toEqual({ orderId: 'order-001', customerId: 'cust-001', replayed: false });
    expect(tx.orderLine.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ additionRequestLineId: 'addition-line-001', quantity: 2, lineTotal: 200 })],
      skipDuplicates: true,
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-001', revision: 7, status: { in: ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED'] } },
      data: expect.objectContaining({ revision: { increment: 1 }, total: { increment: 190 } }),
    }));
    expect(tx.orderActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'ADDITION_APPROVED', actorUserId: 'admin-001' }),
    });
  });

  it('replays an already approved request without appending lines again', async () => {
    const tx = makeTx();
    tx.orderAdditionRequest.findUnique.mockResolvedValue({
      id: 'request-001', status: 'APPROVED', revision: 3, customerId: 'cust-001',
      order: { id: 'order-001', status: 'APPROVED', revision: 8 }, lines: [],
    });

    await expect(approveAdditionRequest(tx as never, {
      requestId: 'request-001', reviewerUserId: 'admin-001', now: new Date(),
    })).resolves.toEqual({ orderId: 'order-001', customerId: 'cust-001', replayed: true });
    expect(tx.orderLine.createMany).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it('rejects without mutating the order and stores the reason', async () => {
    const tx = makeTx();
    tx.orderAdditionRequest.findUnique.mockResolvedValue({
      id: 'request-001', status: 'PENDING', revision: 2, customerId: 'cust-001',
      order: { id: 'order-001' },
    });
    tx.orderAdditionRequest.updateMany.mockResolvedValue({ count: 1 });

    await rejectAdditionRequest(tx as never, {
      requestId: 'request-001', reviewerUserId: 'admin-001', reason: 'המוצר אינו במלאי', now: new Date(),
    });

    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.orderAdditionRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REJECTED', rejectionReason: 'המוצר אינו במלאי' }),
    }));
    expect(tx.orderActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'ADDITION_REJECTED', actorUserId: 'admin-001' }),
    });
  });
});
