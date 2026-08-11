import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    customer: { findUnique: vi.fn() },
    promotion: { findMany: vi.fn() },
    order: { findFirst: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { prisma } = await import('@/lib/db');
const { createSubmittedOrder } = await import('./service');

describe('order service idempotency', () => {
  it('replays a scoped order before recalculating products or prices', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: 'order-existing',
      orderNumber: 1042,
      status: 'SUBMITTED',
      routeId: 'route-old',
    } as never);

    const result = await createSubmittedOrder({
      customerId: 'cust-1',
      idempotencyKey: '9d31ee3f-3eb9-4cbc-b0ff-d48ed1daed71',
      items: [{ productId: 'product-disabled-since-first-request', quantity: 2 }],
      source: 'CUSTOMER',
      paymentTerm: 'NET_30',
      commercialTermsAccepted: true,
      replaceDraftForDeliveryWindow: true,
    });

    expect(result).toEqual({
      orderId: 'order-existing',
      orderNumber: 1042,
      status: 'SUBMITTED',
      routeId: 'route-old',
      replayed: true,
    });
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
    expect(prisma.promotion.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
