import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminDashboardData } from './queries';

vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
    },
    route: {
      findMany: vi.fn(),
    },
    reminderJob: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/features/orders/utils', () => ({
  activeOrderStatuses: ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED', 'PACKED'],
}));

const { prisma } = await import('@/lib/db');
const mockedOrderFindMany = vi.mocked(prisma.order.findMany);
const mockedRouteFindMany = vi.mocked(prisma.route.findMany);
const mockedReminderJobFindMany = vi.mocked(prisma.reminderJob.findMany);

describe('admin dashboard queries', () => {
  beforeEach(() => {
    mockedOrderFindMany.mockReset();
    mockedRouteFindMany.mockReset();
    mockedReminderJobFindMany.mockReset();
  });

  it('returns full active order review data without hiding orders behind a preview limit', async () => {
    mockedOrderFindMany.mockResolvedValue([
      {
        id: 'ord-1',
        customerId: 'cust-1',
        status: 'SUBMITTED',
        source: 'CUSTOMER',
        submittedAt: new Date('2026-07-01T08:00:00.000Z'),
        deliveryWindowStart: new Date('2026-07-02T08:00:00.000Z'),
        subtotal: 120,
        discountTotal: 10,
        total: 110,
        notes: 'Call before delivery',
        internalNote: 'Customer asked for early delivery',
        customer: {
          id: 'cust-1',
          name: 'Cafe Lev',
          contact: 'Dana',
          phone: '050-111-2222',
        },
        route: { id: 'route-a', name: 'North' },
        lines: [
          {
            id: 'line-1',
            productName: 'Tahini',
            quantity: 3,
            listUnitPrice: 40,
            unitPrice: 35,
            lineSubtotal: 120,
            discountTotal: 15,
            lineTotal: 105,
            promotionSnapshot: { tag: 'מבצע קיץ' },
          },
        ],
        notificationJobs: [
          {
            id: 'job-1',
            status: 'FAILED',
            templateKey: 'ORDER_RECEIVED',
            processedAt: new Date('2026-07-01T08:02:00.000Z'),
            scheduledAt: new Date('2026-07-01T08:01:00.000Z'),
            errorMessage: 'Meta timeout',
          },
        ],
      },
    ] as never);
    mockedRouteFindMany.mockResolvedValue([
      {
        id: 'route-a',
        name: 'North',
        nextDeliveryAt: new Date('2026-07-02T08:00:00.000Z'),
        nextCutoffAt: new Date('2026-07-01T18:00:00.000Z'),
        customers: [
          {
            id: 'cust-1',
            name: 'Cafe Lev',
            contact: 'Dana',
            phone: '050-111-2222',
            orders: [{ id: 'ord-1' }],
          },
          {
            id: 'cust-2',
            name: 'Bistro Yam',
            contact: 'Noam',
            phone: '050-333-4444',
            orders: [],
          },
        ],
      },
    ] as never);
    mockedReminderJobFindMany.mockResolvedValue([] as never);

    const data = await getAdminDashboardData();

    expect(mockedOrderFindMany).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.any(Number) }));
    expect(data.orders[0]).toMatchObject({
      id: 'ord-1',
      customerContact: 'Dana',
      customerPhone: '050-111-2222',
      notes: 'Call before delivery',
      internalNote: 'Customer asked for early delivery',
      latestNotification: {
        id: 'job-1',
        status: 'FAILED',
        templateKey: 'ORDER_RECEIVED',
        errorMessage: 'Meta timeout',
      },
      lines: [
        {
          id: 'line-1',
          productName: 'Tahini',
          quantity: 3,
          unitPrice: 35,
          promotionLabel: 'מבצע קיץ',
        },
      ],
    });
    expect(data.routes[0]).toMatchObject({
      missingCount: 1,
      missingCustomers: [
        {
          id: 'cust-2',
          name: 'Bistro Yam',
          contact: 'Noam',
          phone: '050-333-4444',
        },
      ],
    });
  });
});
