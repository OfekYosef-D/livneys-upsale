import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/db', () => ({ prisma: { order: { findFirst: vi.fn() } } }));

const { prisma } = await import('../../lib/db');
const { getActiveOrderForDelivery, getCustomerOrderAdditionData } = await import('./queries');

describe('order addition queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('finds the existing non-draft order for the exact delivery window', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({ id: 'order-001', orderNumber: 1042 } as never);
    const deliveryWindowStart = new Date('2026-08-19T08:00:00.000Z');

    await expect(getActiveOrderForDelivery('cust-001', deliveryWindowStart)).resolves.toEqual({
      id: 'order-001', orderNumber: 1042,
    });
    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: {
        customerId: 'cust-001', deliveryWindowStart,
        status: { in: ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED', 'PACKED', 'DELIVERED'] },
      },
      select: { id: true, orderNumber: true },
    });
  });

  it('scopes the human order number to the customer company', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null);
    await expect(getCustomerOrderAdditionData('cust-002', 1042)).resolves.toBeNull();
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: 'cust-002', orderNumber: 1042, status: { not: 'DRAFT' } },
    }));
  });
});
