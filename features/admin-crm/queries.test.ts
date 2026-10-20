import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMock } from '@/test/prisma-mock';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('@/features/orders/tax-rates', () => ({ getEffectiveVatRate: vi.fn(async () => ({ ratePercent: 17 })) }));
vi.mock('@/features/pricing/promotions', () => ({
  loadActivePromotions: vi.fn(async () => []),
  getPromotionProductIds: vi.fn(() => []),
}));
vi.mock('@/features/catalog/customer-catalog', () => ({
  customerCatalogInclude: {},
  priceCustomerCatalog: vi.fn(() => [{ id: 'prod-a' }]),
}));

const { prisma } = await import('@/lib/db');
const db = asMock(prisma);
const { getEffectiveVatRate } = await import('@/features/orders/tax-rates');
const { getCustomerManagementData, getManualOrderData, getRouteManagementData } = await import('./queries');

const realCustomersFilter = {
  OR: [
    { email: null },
    { NOT: { email: { endsWith: '@livneys.local', mode: 'insensitive' } } },
  ],
};

beforeEach(() => {
  db.$reset();
  db.customer.findMany.mockResolvedValue([]);
  db.route.findMany.mockResolvedValue([]);
  db.priceList.findMany.mockResolvedValue([]);
});

describe('customer management queries', () => {
  it('keeps customers without email while excluding @livneys.local demo accounts', async () => {
    await getCustomerManagementData();

    expect(db.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: realCustomersFilter }));
  });

  it('maps notification preferences, order counts and the latest order', async () => {
    db.customer.findMany.mockResolvedValue([{
      id: 'cust-1',
      name: 'Cafe',
      route: { name: 'North' },
      priceList: { name: 'Standard' },
      notificationPreference: null,
      _count: { orders: 3 },
      orders: [{ status: 'SUBMITTED', submittedAt: new Date('2026-10-01T08:00:00.000Z'), totalIncludingVat: '123.40' }],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    }]);

    const data = await getCustomerManagementData();

    expect(data.customers[0]).toMatchObject({
      id: 'cust-1',
      routeName: 'North',
      priceListName: 'Standard',
      emailEnabled: true,
      whatsappEnabled: false,
      orderCount: 3,
      latestOrder: { status: 'SUBMITTED', submittedAt: '2026-10-01T08:00:00.000Z', totalIncludingVat: 123.4 },
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('route management queries', () => {
  it('rolls a past delivery anchor forward to the current weekly window', async () => {
    db.route.findMany.mockResolvedValue([{
      id: 'route-a',
      name: 'North',
      deliveryWeekday: 2,
      cutoffWeekday: 1,
      cutoffTime: '18:00',
      nextDeliveryAt: new Date('2026-10-06T05:00:00.000Z'),
      nextCutoffAt: new Date('2026-10-05T15:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { customers: 4 },
    }]);

    const data = await getRouteManagementData(new Date('2026-10-08T12:00:00.000Z'));

    expect(data.routes[0]).toMatchObject({
      id: 'route-a',
      customerCount: 4,
      deliveryAt: '2026-10-13T05:00:00.000Z',
      cutoffAt: '2026-10-12T15:00:00.000Z',
    });
  });
});

describe('manual order queries', () => {
  it('exposes the effective VAT rate and each customer current delivery window', async () => {
    db.customer.findMany.mockResolvedValue([{
      id: 'cust-1',
      name: 'Cafe',
      contact: 'Dana',
      phone: '050',
      route: {
        name: 'North',
        cutoffWeekday: 1,
        cutoffTime: '18:00',
        nextDeliveryAt: new Date('2026-10-13T05:00:00.000Z'),
        nextCutoffAt: new Date('2026-10-12T15:00:00.000Z'),
      },
      priceList: { name: 'Standard' },
    }]);

    const data = await getManualOrderData(new Date('2026-10-08T12:00:00.000Z'));

    expect(getEffectiveVatRate).toHaveBeenCalledOnce();
    expect(db.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isActive: true, route: { isActive: true }, OR: expect.any(Array) }) }));
    expect(data).toEqual({
      vatRatePercent: 17,
      customers: [{
        id: 'cust-1',
        name: 'Cafe',
        contact: 'Dana',
        phone: '050',
        routeName: 'North',
        priceListName: 'Standard',
        deliveryAt: '2026-10-13T05:00:00.000Z',
        products: [{ id: 'prod-a' }],
      }],
    });
  });
});
