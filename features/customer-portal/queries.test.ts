import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMock } from '@/test/prisma-mock';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('@/features/orders/tax-rates', () => ({ getEffectiveVatRate: vi.fn(async () => ({ id: 'vat', ratePercent: 18 })) }));
vi.mock('@/features/pricing/promotions', () => ({ loadActivePromotions: vi.fn(async () => []) }));
vi.mock('@/features/catalog/customer-catalog', () => ({
  customerCatalogInclude: {},
  priceCustomerCatalog: vi.fn(() => [{ id: 'prod-a' }, { id: 'prod-b' }, { id: 'prod-c' }]),
}));

const { prisma } = await import('@/lib/db');
const db = asMock(prisma);
const { getCustomerPortalData } = await import('./queries');

const now = new Date('2026-10-14T12:00:00.000Z');
const delivery = new Date('2026-10-20T05:00:00.000Z');

const customer = {
  id: 'cust-1',
  name: 'Cafe',
  contact: 'Dana',
  route: {
    name: 'North',
    cutoffWeekday: 1,
    cutoffTime: '18:00',
    nextDeliveryAt: delivery,
    nextCutoffAt: new Date('2026-10-19T15:00:00.000Z'),
    opsContactName: 'Ops',
    opsContactPhone: '050',
  },
  recommendations: [{ productId: 'prod-c' }],
};

const draft = { id: 'draft-1', orderNumber: 2001, lines: [{ productId: 'prod-b', quantity: 4 }] };
const lastOrder = { id: 'ord-1', orderNumber: 1001, lines: [{ productId: 'prod-a', quantity: 6 }] };

type FindFirstArgs = { where: { status: unknown }; select?: unknown };

/** The portal loads the active order (select), this week's draft (status DRAFT) and the last placed order. */
function mockOrders({ activeOrder = null, draftOrder = null, previous = null }: { activeOrder?: unknown; draftOrder?: unknown; previous?: unknown }) {
  db.order.findFirst.mockImplementation(async ({ where, select }: FindFirstArgs) => {
    if (where.status === 'DRAFT') return draftOrder;
    if (select) return activeOrder;
    return previous;
  });
}

beforeEach(() => {
  db.$reset();
  db.customer.findUnique.mockResolvedValue(customer);
});

describe('getCustomerPortalData cart seed', () => {
  it("prefers this week's draft over the previous order", async () => {
    mockOrders({ draftOrder: draft, previous: lastOrder });

    const data = await getCustomerPortalData('cust-1', now);

    expect(data.cartSeed).toEqual({ source: 'DRAFT', orderNumber: null, lines: [{ productId: 'prod-b', quantity: 4 }] });
    expect(db.order.findFirst).toHaveBeenCalledWith({
      where: { customerId: 'cust-1', deliveryWindowStart: delivery, status: 'DRAFT' },
      include: { lines: true },
    });
  });

  it('falls back to re-ordering the previous order', async () => {
    mockOrders({ previous: lastOrder });

    const data = await getCustomerPortalData('cust-1', now);

    expect(data.cartSeed).toEqual({ source: 'PREVIOUS_ORDER', orderNumber: 1001, lines: [{ productId: 'prod-a', quantity: 6 }] });
  });

  it('starts empty for a first order', async () => {
    mockOrders({});

    const data = await getCustomerPortalData('cust-1', now);

    expect(data.cartSeed).toEqual({ source: 'EMPTY', orderNumber: null, lines: [] });
    expect(data.activeOrder).toBeNull();
  });

  it('flags recommended and previously ordered products and exposes the schedule', async () => {
    mockOrders({ activeOrder: { id: 'ord-2', orderNumber: 1002 }, previous: lastOrder });

    const data = await getCustomerPortalData('cust-1', now);

    expect(data.products).toEqual([
      { id: 'prod-a', isRecommended: false, isPreviousOrder: true },
      { id: 'prod-b', isRecommended: false, isPreviousOrder: false },
      { id: 'prod-c', isRecommended: true, isPreviousOrder: false },
    ]);
    expect(data.activeOrder).toEqual({ id: 'ord-2', orderNumber: 1002 });
    expect(data.vatRatePercent).toBe(18);
    expect(data.schedule).toEqual({
      routeName: 'North',
      deliveryAt: delivery.toISOString(),
      cutoffAt: '2026-10-19T15:00:00.000Z',
      isPastCutoff: false,
      opsContactName: 'Ops',
      opsContactPhone: '050',
    });
  });

  it('reports a past cut-off', async () => {
    mockOrders({});

    const data = await getCustomerPortalData('cust-1', new Date('2026-10-19T16:00:00.000Z'));

    expect(data.schedule.isPastCutoff).toBe(true);
  });

  it('throws notFound for an unknown customer', async () => {
    db.customer.findUnique.mockResolvedValue(null);

    await expect(getCustomerPortalData('missing', now)).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
