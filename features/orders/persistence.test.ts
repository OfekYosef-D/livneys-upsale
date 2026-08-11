import { describe, expect, it, vi } from 'vitest';
import {
  cancelDraftOrder,
  isRetryableOrderWriteError,
  persistDraftOrder,
  persistSubmittedOrder,
} from './persistence';

const payload = {
  order: {
    customerId: 'cust-1',
    routeId: 'route-1',
    status: 'SUBMITTED' as const,
    source: 'CUSTOMER' as const,
    deliveryWindowStart: new Date('2026-08-12T08:00:00.000Z'),
    deadlineAt: new Date('2026-08-11T12:00:00.000Z'),
    submittedAt: new Date('2026-08-11T09:00:00.000Z'),
    notes: null,
    internalNote: null,
    subtotal: 100,
    discountTotal: 0,
    paymentTerm: 'NET_30' as const,
    paymentDiscountPercent: 0,
    paymentDiscountTotal: 0,
    total: 100,
    vatRatePercent: 18,
    vatTotal: 18,
    totalIncludingVat: 118,
    commercialTermsVersion: '2026-08-10',
    commercialTermsAcceptedAt: new Date('2026-08-11T09:00:00.000Z'),
  },
  lines: [
    {
      productId: 'product-1',
      productName: 'Product 1',
      quantity: 2,
      listUnitPrice: 50,
      unitPrice: 50,
      lineSubtotal: 100,
      discountTotal: 0,
      lineTotal: 100,
      promotionId: null,
      promotionSnapshot: null,
    },
  ],
};

function createTransaction() {
  return {
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    orderLine: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  };
}

describe('submitted order persistence', () => {
  it('recognizes unique and serializable transaction conflicts as retryable', () => {
    expect(isRetryableOrderWriteError({ code: 'P2002' })).toBe(true);
    expect(isRetryableOrderWriteError({ code: 'P2034' })).toBe(true);
    expect(isRetryableOrderWriteError({ code: 'P2025' })).toBe(false);
    expect(isRetryableOrderWriteError(new Error('network failure'))).toBe(false);
  });

  it('replays the existing order for the same idempotency key without writing', async () => {
    const tx = createTransaction();
    tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 1001,
      status: 'SUBMITTED',
      routeId: 'route-1',
      customerId: 'cust-1',
      deliveryWindowStart: payload.order.deliveryWindowStart,
      idempotencyKey: 'request-1',
      revision: 2,
    });

    const result = await persistSubmittedOrder(tx, {
      payload,
      idempotencyKey: 'request-1',
      replaceDraftForDeliveryWindow: true,
    });

    expect(result.replayed).toBe(true);
    expect(result.order.id).toBe('order-1');
    expect(tx.order.findFirst).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('does not replay an idempotency key that belongs to another customer', async () => {
    const tx = createTransaction();
    tx.order.findUnique.mockResolvedValue({
      id: 'order-other-customer',
      orderNumber: 1099,
      status: 'SUBMITTED',
      routeId: 'route-2',
      customerId: 'cust-other',
      deliveryWindowStart: payload.order.deliveryWindowStart,
      idempotencyKey: 'request-shared',
      revision: 1,
    });

    await expect(persistSubmittedOrder(tx, {
      payload,
      idempotencyKey: 'request-shared',
      replaceDraftForDeliveryWindow: true,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT' });

    expect(tx.order.findFirst).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('returns a typed conflict when another non-cancelled order owns the delivery window', async () => {
    const tx = createTransaction();
    tx.order.findUnique.mockResolvedValue(null);
    tx.order.findFirst.mockResolvedValue({
      id: 'order-existing',
      orderNumber: 1007,
      status: 'APPROVED',
      routeId: 'route-1',
      customerId: 'cust-1',
      deliveryWindowStart: payload.order.deliveryWindowStart,
      idempotencyKey: 'another-request',
      revision: 3,
    });

    await expect(persistSubmittedOrder(tx, {
      payload,
      idempotencyKey: 'request-2',
      replaceDraftForDeliveryWindow: true,
    })).rejects.toMatchObject({
      code: 'ACTIVE_ORDER_EXISTS',
      orderId: 'order-existing',
      orderNumber: 1007,
    });

    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('submits the existing draft with an optimistic revision check', async () => {
    const tx = createTransaction();
    tx.order.findUnique.mockResolvedValue(null);
    tx.order.findFirst.mockResolvedValue({
      id: 'draft-1',
      orderNumber: 1008,
      status: 'DRAFT',
      routeId: 'route-1',
      customerId: 'cust-1',
      deliveryWindowStart: payload.order.deliveryWindowStart,
      idempotencyKey: null,
      revision: 4,
    });
    tx.order.updateMany.mockResolvedValue({ count: 1 });
    tx.order.findUniqueOrThrow.mockResolvedValue({
      id: 'draft-1',
      orderNumber: 1008,
      status: 'SUBMITTED',
      routeId: 'route-1',
      customerId: 'cust-1',
      deliveryWindowStart: payload.order.deliveryWindowStart,
      idempotencyKey: 'request-3',
      revision: 5,
    });

    const result = await persistSubmittedOrder(tx, {
      payload,
      idempotencyKey: 'request-3',
      replaceDraftForDeliveryWindow: true,
    });

    expect(result.replayed).toBe(false);
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'draft-1', status: 'DRAFT', revision: 4 },
      data: expect.objectContaining({
        idempotencyKey: 'request-3',
        revision: { increment: 1 },
      }),
    }));
    expect(tx.orderLine.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'draft-1' } });
    expect(tx.orderLine.createMany).toHaveBeenCalledOnce();
  });

  it('creates a new order when the delivery window is available', async () => {
    const tx = createTransaction();
    tx.order.findUnique.mockResolvedValue(null);
    tx.order.findFirst.mockResolvedValue(null);
    tx.order.create.mockResolvedValue({
      id: 'order-new',
      orderNumber: 1009,
      status: 'SUBMITTED',
      routeId: 'route-1',
      customerId: 'cust-1',
      deliveryWindowStart: payload.order.deliveryWindowStart,
      idempotencyKey: 'request-4',
      revision: 1,
    });

    const result = await persistSubmittedOrder(tx, {
      payload,
      idempotencyKey: 'request-4',
      replaceDraftForDeliveryWindow: true,
    });

    expect(result).toMatchObject({ replayed: false, order: { id: 'order-new', orderNumber: 1009 } });
    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idempotencyKey: 'request-4' }),
    }));
  });
});

describe('draft order persistence', () => {
  it('cancels an emptied draft without touching submitted orders', async () => {
    const tx = createTransaction();
    tx.order.findFirst.mockResolvedValue({
      id: 'draft-empty',
      orderNumber: 1012,
      status: 'DRAFT',
      routeId: 'route-1',
      customerId: 'cust-1',
      deliveryWindowStart: payload.order.deliveryWindowStart,
      idempotencyKey: null,
      revision: 2,
    });
    tx.order.updateMany.mockResolvedValue({ count: 1 });

    const result = await cancelDraftOrder(tx, {
      customerId: 'cust-1',
      deliveryWindowStart: payload.order.deliveryWindowStart,
    });

    expect(result).toEqual({ orderId: 'draft-empty', cancelled: true });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'draft-empty', status: 'DRAFT', revision: 2 },
      data: { status: 'CANCELLED', revision: { increment: 1 } },
    });
  });

  it('updates the single draft for a delivery window with a revision check', async () => {
    const tx = createTransaction();
    tx.order.findFirst.mockResolvedValue({
      id: 'draft-1',
      orderNumber: 1010,
      status: 'DRAFT',
      routeId: 'route-1',
      customerId: 'cust-1',
      deliveryWindowStart: payload.order.deliveryWindowStart,
      idempotencyKey: null,
      revision: 2,
    });
    tx.order.updateMany.mockResolvedValue({ count: 1 });
    tx.order.findUniqueOrThrow.mockResolvedValue({
      id: 'draft-1',
      orderNumber: 1010,
      status: 'DRAFT',
      routeId: 'route-1',
      customerId: 'cust-1',
      deliveryWindowStart: payload.order.deliveryWindowStart,
      idempotencyKey: null,
      revision: 3,
    });

    const result = await persistDraftOrder(tx, {
      payload: { ...payload, order: { ...payload.order, status: 'DRAFT' } },
    });

    expect(result.order.id).toBe('draft-1');
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'draft-1', status: 'DRAFT', revision: 2 },
      data: expect.objectContaining({ revision: { increment: 1 } }),
    }));
  });

  it('does not overwrite an already submitted order for the delivery window', async () => {
    const tx = createTransaction();
    tx.order.findFirst.mockResolvedValue({
      id: 'order-locked',
      orderNumber: 1011,
      status: 'SUBMITTED',
      routeId: 'route-1',
      customerId: 'cust-1',
      deliveryWindowStart: payload.order.deliveryWindowStart,
      idempotencyKey: 'request-existing',
      revision: 1,
    });

    await expect(persistDraftOrder(tx, {
      payload: { ...payload, order: { ...payload.order, status: 'DRAFT' } },
    })).rejects.toMatchObject({ code: 'ACTIVE_ORDER_EXISTS', orderId: 'order-locked' });

    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});
