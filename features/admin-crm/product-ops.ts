import type { TransactionClient } from '@/lib/transactions';

/** Raising the minimum never leaves it below the case multiple. */
export function resolveOrderMultipleAfterMinQty(minQty: number, currentOrderMultiple: number) {
  return Math.max(minQty, currentOrderMultiple);
}

/**
 * Sets one price for the given products everywhere: base price, every existing price-list row,
 * and price lists that did not list the product yet. Saved orders are unaffected (they keep snapshots).
 */
export async function applyPriceToProducts(
  tx: Pick<TransactionClient, 'product' | 'priceList' | 'priceListItem'>,
  productIds: string[],
  price: number,
) {
  if (productIds.length === 0) return;

  await tx.product.updateMany({ where: { id: { in: productIds } }, data: { basePrice: price } });
  await tx.priceListItem.updateMany({ where: { productId: { in: productIds } }, data: { price } });

  const [lists, existing] = await Promise.all([
    tx.priceList.findMany({ select: { id: true } }),
    tx.priceListItem.findMany({ where: { productId: { in: productIds } }, select: { productId: true, priceListId: true } }),
  ]);
  const present = new Set(existing.map((item) => `${item.priceListId}:${item.productId}`));
  const missing = lists.flatMap((list) =>
    productIds.filter((productId) => !present.has(`${list.id}:${productId}`)).map((productId) => ({ priceListId: list.id, productId, price })));

  if (missing.length > 0) await tx.priceListItem.createMany({ data: missing });
}
