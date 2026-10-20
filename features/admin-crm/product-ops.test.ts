import { describe, expect, it, vi } from 'vitest';
import { applyPriceToProducts, resolveOrderMultipleAfterMinQty } from './product-ops';

function createTx({ lists, existing }: { lists: Array<{ id: string }>; existing: Array<{ productId: string; priceListId: string }> }) {
  return {
    product: { updateMany: vi.fn() },
    priceList: { findMany: vi.fn().mockResolvedValue(lists) },
    priceListItem: {
      updateMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue(existing),
      createMany: vi.fn(),
    },
  };
}

type ApplyTx = Parameters<typeof applyPriceToProducts>[0];

describe('resolveOrderMultipleAfterMinQty', () => {
  it('raises the order multiple when the new minimum is larger', () => {
    expect(resolveOrderMultipleAfterMinQty(8, 6)).toBe(8);
  });

  it('keeps the current multiple when the new minimum is smaller or equal', () => {
    expect(resolveOrderMultipleAfterMinQty(4, 6)).toBe(6);
    expect(resolveOrderMultipleAfterMinQty(6, 6)).toBe(6);
  });
});

describe('applyPriceToProducts', () => {
  it('updates the base price and every price-list row, then fills missing lists', async () => {
    const tx = createTx({ lists: [{ id: 'list-a' }, { id: 'list-b' }], existing: [{ productId: 'prod-1', priceListId: 'list-a' }] });

    await applyPriceToProducts(tx as unknown as ApplyTx, ['prod-1', 'prod-2'], 35);

    expect(tx.product.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['prod-1', 'prod-2'] } }, data: { basePrice: 35 } });
    expect(tx.priceListItem.updateMany).toHaveBeenCalledWith({ where: { productId: { in: ['prod-1', 'prod-2'] } }, data: { price: 35 } });
    expect(tx.priceListItem.createMany).toHaveBeenCalledWith({
      data: [
        { priceListId: 'list-a', productId: 'prod-2', price: 35 },
        { priceListId: 'list-b', productId: 'prod-1', price: 35 },
        { priceListId: 'list-b', productId: 'prod-2', price: 35 },
      ],
    });
  });

  it('skips createMany when every list already has a row', async () => {
    const tx = createTx({ lists: [{ id: 'list-a' }], existing: [{ productId: 'prod-1', priceListId: 'list-a' }] });

    await applyPriceToProducts(tx as unknown as ApplyTx, ['prod-1'], 16.9);

    expect(tx.priceListItem.updateMany).toHaveBeenCalledOnce();
    expect(tx.priceListItem.createMany).not.toHaveBeenCalled();
  });

  it('does nothing for an empty product list', async () => {
    const tx = createTx({ lists: [{ id: 'list-a' }], existing: [] });

    await applyPriceToProducts(tx as unknown as ApplyTx, [], 10);

    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.priceListItem.updateMany).not.toHaveBeenCalled();
    expect(tx.priceListItem.createMany).not.toHaveBeenCalled();
  });
});
