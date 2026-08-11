import { describe, expect, it, vi } from 'vitest';

const customerFindMany = vi.hoisted(() => vi.fn(async () => []));
const routeFindMany = vi.hoisted(() => vi.fn(async () => []));
const priceListFindMany = vi.hoisted(() => vi.fn(async () => []));

vi.mock('@/lib/db', () => ({
  prisma: {
    customer: { findMany: customerFindMany },
    route: { findMany: routeFindMany },
    priceList: { findMany: priceListFindMany },
  },
}));
vi.mock('@/features/pricing/engine', () => ({ resolveCatalogPricing: vi.fn() }));

const { getCustomerManagementData } = await import('./queries');

describe('customer management queries', () => {
  it('keeps customers without email while excluding retired local-domain demos', async () => {
    await getCustomerManagementData();

    expect(customerFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { email: null },
          { NOT: { email: { endsWith: '@livneys.local', mode: 'insensitive' } } },
        ],
      },
    }));
  });
});
