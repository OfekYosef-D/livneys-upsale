import { describe, expect, it, vi } from 'vitest';

const customerFindMany = vi.hoisted(() => vi.fn(async () => []));
const routeFindMany = vi.hoisted(() => vi.fn(async () => []));
const priceListFindMany = vi.hoisted(() => vi.fn(async () => []));
const promotionFindMany = vi.hoisted(() => vi.fn(async () => []));
const getEffectiveVatRate = vi.hoisted(() => vi.fn(async () => ({ ratePercent: 17 })));

vi.mock('@/lib/db', () => ({
  prisma: {
    customer: { findMany: customerFindMany },
    route: { findMany: routeFindMany },
    priceList: { findMany: priceListFindMany },
    promotion: { findMany: promotionFindMany },
  },
}));
vi.mock('@/features/pricing/engine', () => ({ resolveCatalogPricing: vi.fn() }));
vi.mock('@/features/orders/tax-rates', () => ({ getEffectiveVatRate }));

const { getCustomerManagementData, getManualOrderData } = await import('./queries');

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

  it('exposes the effective VAT rate to the manual-order preview', async () => {
    await expect(getManualOrderData()).resolves.toMatchObject({ vatRatePercent: 17 });
    expect(getEffectiveVatRate).toHaveBeenCalledOnce();
  });
});
