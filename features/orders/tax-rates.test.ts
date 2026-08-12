import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.hoisted(() => vi.fn());
vi.mock('../../lib/db', () => ({ prisma: { taxRate: { findFirst } } }));

const { getEffectiveVatRate } = await import('./tax-rates');

describe('dated VAT configuration', () => {
  beforeEach(() => findFirst.mockReset());

  it('selects the latest Israeli rate effective at the pricing timestamp', async () => {
    const at = new Date('2026-08-12T09:30:00.000Z');
    findFirst.mockResolvedValue({ id: 'israel-standard-2025-01-01', ratePercent: 18 });

    await expect(getEffectiveVatRate(at)).resolves.toEqual({
      id: 'israel-standard-2025-01-01',
      ratePercent: 18,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        jurisdiction: 'IL',
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { id: true, ratePercent: true },
    });
  });

  it('fails closed when no VAT rate covers the order timestamp', async () => {
    findFirst.mockResolvedValue(null);
    await expect(getEffectiveVatRate(new Date())).rejects.toMatchObject({ code: 'TAX_RATE_NOT_CONFIGURED' });
  });
});
