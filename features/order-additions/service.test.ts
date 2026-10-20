import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMock } from '@/test/prisma-mock';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('../orders/service', () => ({
  getOrderWriteContext: vi.fn(async () => ({
    customerId: 'cust-1',
    routeId: 'route-1',
    vatRatePercent: 18,
    schedule: { deliveryAt: new Date(), cutoffAt: new Date() },
    pricing: {
      target: { customerId: 'cust-1', routeId: 'route-1', priceListId: 'l' },
      products: [{ id: 'p1', name: 'P', category: 'C', basePrice: 100, isActive: true, minQty: 1, orderMultiple: 1 }],
      priceListItems: [],
      promotions: [],
    },
  })),
}));

const { prisma } = await import('@/lib/db');
const { submitOrderAddition } = await import('./service');
const db = asMock(prisma);
const audit = vi.fn();

describe('order addition service', () => {
  beforeEach(() => db.$reset());

  it('prices the addition at the VAT rate the original order was placed with', async () => {
    db.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'SUBMITTED', paymentTerm: 'NET_30', vatRatePercent: 17, lines: [] });
    db.orderAdditionRequest.findFirst.mockResolvedValue(null);
    db.order.findUnique.mockResolvedValue({ customerId: 'cust-1', status: 'SUBMITTED', revision: 1 });
    db.orderAdditionRequest.create.mockResolvedValue({ id: 'req-1' });
    db.orderAdditionRequest.findUniqueOrThrow.mockResolvedValue({ id: 'req-1' });

    await expect(submitOrderAddition({ customerId: 'cust-1', orderId: 'order-1', idempotencyKey: 'k', items: [{ productId: 'p1', quantity: 1 }], actor: { userId: 'u', audit } }))
      .resolves.toEqual({ requestId: 'req-1', replayed: false });
    expect(db.orderAdditionRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ vatRatePercent: 17, vatTotal: 17, totalIncludingVat: 117 }) }));
  });

  it('refuses an order of another customer', async () => {
    db.order.findFirst.mockResolvedValue(null);
    await expect(submitOrderAddition({ customerId: 'cust-1', orderId: 'x', idempotencyKey: 'k', items: [{ productId: 'p1', quantity: 1 }], actor: { userId: 'u', audit } }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
