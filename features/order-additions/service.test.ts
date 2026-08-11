import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  prisma: {
    order: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../orders/service', () => ({
  getOrderWriteContext: vi.fn(),
}));

vi.mock('./persistence', async (importOriginal) => {
  const original = await importOriginal<typeof import('./persistence')>();
  return { ...original, persistPendingAdditionRequest: vi.fn() };
});

const { prisma } = await import('../../lib/db');
const { getOrderWriteContext } = await import('../orders/service');
const { persistPendingAdditionRequest } = await import('./persistence');
const { submitOrderAddition } = await import('./service');

const context = {
  customer: { id: 'cust-001', routeId: 'route-001', priceListId: 'price-list-001', isActive: true },
  route: {
    id: 'route-001', isActive: true,
    nextDeliveryAt: new Date('2026-08-19T08:00:00.000Z'),
    nextCutoffAt: new Date('2026-08-17T08:00:00.000Z'),
  },
  products: [{ id: 'product-001', name: 'טחינה', category: 'ממרחים', basePrice: 100, isActive: true, minQty: 1, orderMultiple: 1 }],
  priceListItems: [{ productId: 'product-001', price: 100 }],
  promotions: [],
};

describe('order addition service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('snapshots additions with the original order payment term in a serializable transaction', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: 'order-001', customerId: 'cust-001', status: 'APPROVED', revision: 7,
      paymentTerm: 'IMMEDIATE_OR_CASH', deliveryWindowStart: context.route.nextDeliveryAt,
      lines: [{ productId: 'product-001', quantity: 2 }],
    } as never);
    vi.mocked(getOrderWriteContext).mockResolvedValue(context);
    vi.mocked(persistPendingAdditionRequest).mockResolvedValue({
      request: { id: 'request-001', status: 'PENDING', revision: 1 }, replayed: false,
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback({} as never));

    const result = await submitOrderAddition({
      customerId: 'cust-001', orderId: 'order-001',
      idempotencyKey: '1f4106db-26c3-49ed-9cf6-c625dd18fc73',
      items: [{ productId: 'product-001', quantity: 2 }],
      now: new Date('2026-08-11T12:00:00.000Z'),
    });

    expect(result).toEqual({ requestId: 'request-001', status: 'PENDING', replayed: false });
    expect(persistPendingAdditionRequest).toHaveBeenCalledWith({}, expect.objectContaining({
      paymentTerm: 'IMMEDIATE_OR_CASH', orderRevision: 7,
      snapshot: expect.objectContaining({ paymentDiscountTotal: 10, totalIncludingVat: 224.2 }),
    }));
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('does not allow a customer to add to another company order', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null);
    await expect(submitOrderAddition({
      customerId: 'cust-002', orderId: 'order-001',
      idempotencyKey: '1f4106db-26c3-49ed-9cf6-c625dd18fc73',
      items: [{ productId: 'product-001', quantity: 2 }], now: new Date(),
    })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('retries a serializable race and returns the single open request', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: 'order-001', customerId: 'cust-001', status: 'APPROVED', revision: 7,
      paymentTerm: 'NET_30', deliveryWindowStart: context.route.nextDeliveryAt,
      lines: [],
    } as never);
    vi.mocked(getOrderWriteContext).mockResolvedValue(context);
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback) => callback({} as never));
    vi.mocked(persistPendingAdditionRequest).mockResolvedValue({ request: { id: 'request-001', status: 'PENDING' }, replayed: false } as never);

    await expect(submitOrderAddition({
      customerId: 'cust-001', orderId: 'order-001', idempotencyKey: '1f4106db-26c3-49ed-9cf6-c625dd18fc73',
      items: [{ productId: 'product-001', quantity: 2 }], now: new Date(),
    })).resolves.toMatchObject({ requestId: 'request-001' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
