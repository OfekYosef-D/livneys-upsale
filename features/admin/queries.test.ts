import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMock } from '@/test/prisma-mock';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());

const { prisma } = await import('@/lib/db');
const db = asMock(prisma);
const { getAdminDashboardData, getAdminRouteDetail } = await import('./queries');

const realCustomersFilter = {
  OR: [
    { email: null },
    { NOT: { email: { endsWith: '@livneys.local', mode: 'insensitive' } } },
  ],
};

// Wednesday 2026-10-14 noon UTC; the stored anchor (Tue 2026-10-06) is already in the past.
const now = new Date('2026-10-14T12:00:00.000Z');
const staleAnchor = new Date('2026-10-06T05:00:00.000Z');
const currentDelivery = new Date('2026-10-20T05:00:00.000Z');

const route = {
  id: 'route-a',
  name: 'North',
  driver: 'Avi',
  deliveryWeekday: 2,
  cutoffWeekday: 1,
  cutoffTime: '18:00',
  nextDeliveryAt: staleAnchor,
  nextCutoffAt: new Date('2026-10-05T15:00:00.000Z'),
};

const customers = [
  { id: 'cust-1', name: 'Cafe Lev', contact: 'Dana', phone: '050-111-2222' },
  { id: 'cust-2', name: 'Bistro Yam', contact: 'Noam', phone: '050-333-4444' },
];

const openOrder = {
  id: 'ord-1',
  orderNumber: 1001,
  customerId: 'cust-1',
  routeId: 'route-a',
  status: 'SUBMITTED',
  source: 'CUSTOMER',
  paymentTerm: 'IMMEDIATE_OR_CASH',
  submittedAt: new Date('2026-10-13T08:00:00.000Z'),
  deliveryWindowStart: currentDelivery,
  subtotal: '120',
  discountTotal: '10',
  paymentDiscountPercent: '5',
  paymentDiscountTotal: '5.5',
  total: '104.5',
  vatRatePercent: '18',
  vatTotal: '18.81',
  totalIncludingVat: '123.31',
  commercialTermsVersion: '2026-08-10',
  commercialTermsAcceptedAt: new Date('2026-10-13T08:00:00.000Z'),
  notes: 'Call before delivery',
  internalNote: 'Customer asked for early delivery',
  customer: { name: 'Cafe Lev', contact: 'Dana', phone: '050-111-2222' },
  route: { name: 'North' },
  lines: [{
    id: 'line-1',
    productId: 'prod-1',
    productName: 'Tahini',
    quantity: 3,
    listUnitPrice: '40',
    unitPrice: '35',
    lineSubtotal: '120',
    discountTotal: '15',
    lineTotal: '105',
    promotionSnapshot: { tag: 'מבצע קיץ' },
  }],
};

beforeEach(() => {
  db.$reset();
});

describe('getAdminDashboardData', () => {
  beforeEach(() => {
    db.route.findMany.mockResolvedValue([{ ...route, customers }]);
    db.notificationJob.count.mockResolvedValue(2);
    db.order.findMany.mockImplementation(async (args: { select?: unknown }) =>
      args.select ? [{ customerId: 'cust-1' }] : [openOrder]);
  });

  it('hides @livneys.local demo customers from every operational query', async () => {
    await getAdminDashboardData(now);

    expect(db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED', 'PACKED'] }, customer: realCustomersFilter },
    }));
    expect(db.order.findMany.mock.calls[0]![0]).not.toHaveProperty('take');
    expect(db.route.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true },
      include: { customers: expect.objectContaining({ where: { isActive: true, ...realCustomersFilter } }) },
    }));
    expect(db.notificationJob.count).toHaveBeenCalledWith({ where: { status: 'FAILED', customer: realCustomersFilter } });
  });

  it('finds missing customers in the current delivery window and excludes customers who ordered', async () => {
    const data = await getAdminDashboardData(now);

    expect(db.order.findMany).toHaveBeenCalledWith({
      where: {
        customerId: { in: ['cust-1', 'cust-2'] },
        deliveryWindowStart: currentDelivery,
        status: { in: ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED', 'PACKED', 'DELIVERED'] },
      },
      select: { customerId: true },
    });
    expect(data.routes).toEqual([{
      id: 'route-a',
      name: 'North',
      deliveryAt: currentDelivery.toISOString(),
      cutoffAt: '2026-10-19T15:00:00.000Z',
      customerCount: 2,
      orderedCount: 1,
      missingCustomers: [customers[1]],
    }]);
    expect(data.kpis).toEqual({ needsApproval: 1, readyForRoute: 0, missingOrders: 1, failedNotifications: 2 });
  });

  it('returns full order review data with numeric totals and promotion labels', async () => {
    const data = await getAdminDashboardData(now);

    expect(data.orders[0]).toMatchObject({
      id: 'ord-1',
      orderNumber: 1001,
      customerName: 'Cafe Lev',
      customerContact: 'Dana',
      customerPhone: '050-111-2222',
      routeName: 'North',
      notes: 'Call before delivery',
      internalNote: 'Customer asked for early delivery',
      paymentTerm: 'IMMEDIATE_OR_CASH',
      paymentDiscountPercent: 5,
      paymentDiscountTotal: 5.5,
      total: 104.5,
      vatRatePercent: 18,
      vatTotal: 18.81,
      totalIncludingVat: 123.31,
      submittedAt: '2026-10-13T08:00:00.000Z',
      commercialTermsAcceptedAt: '2026-10-13T08:00:00.000Z',
      lines: [{ id: 'line-1', productName: 'Tahini', quantity: 3, unitPrice: 35, lineTotal: 105, promotionLabel: 'מבצע קיץ' }],
    });
  });

  it('labels orders without a route', async () => {
    db.order.findMany.mockImplementation(async (args: { select?: unknown }) =>
      args.select ? [] : [{ ...openOrder, routeId: null, route: null }]);

    const data = await getAdminDashboardData(now);

    expect(data.orders[0]!.routeName).toBe('ללא קו');
  });
});

describe('getAdminRouteDetail', () => {
  it('returns null for an unknown route', async () => {
    db.route.findUnique.mockResolvedValue(null);

    await expect(getAdminRouteDetail('missing', now)).resolves.toBeNull();
  });

  it('attaches each customer order in the current window and ignores cancelled orders', async () => {
    db.route.findUnique.mockResolvedValue({ ...route, customers });
    db.order.findMany.mockResolvedValue([
      { id: 'ord-1', customerId: 'cust-1', status: 'APPROVED', orderNumber: 1001, totalIncludingVat: '50.5' },
      { id: 'ord-2', customerId: 'cust-2', status: 'CANCELLED', orderNumber: 1002, totalIncludingVat: '10' },
    ]);

    const detail = await getAdminRouteDetail('route-a', now);

    expect(db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ routeId: 'route-a', deliveryWindowStart: currentDelivery }),
    }));
    expect(detail?.customers).toEqual([
      { ...customers[0], order: { id: 'ord-1', orderNumber: 1001, status: 'APPROVED', totalIncludingVat: 50.5 } },
      { ...customers[1], order: null },
    ]);
  });
});
