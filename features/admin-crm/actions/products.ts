'use server';

import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { createEntityId } from '@/lib/ids';
import { adminAction } from '@/lib/server-action';
import type { TransactionClient } from '@/lib/transactions';
import { assertAllExist } from '../guards';
import { applyPriceToProducts, resolveOrderMultipleAfterMinQty } from '../product-ops';
import { activeToggleSchema, bulkCategoryPriceSchema, productSchema, quickProductUpdateSchema, type ProductInput } from '../schemas';

export const saveProductAction = adminAction(productSchema, async ({ id, prices, ...data }, ctx) => {
  await assertAllExist('priceList', prices.map((item) => item.priceListId));

  return prisma.$transaction(async (tx) => {
    const before = id ? await tx.product.findUnique({ where: { id }, include: { priceListItems: true } }) : null;
    if (id && !before) throw new NotFoundError('המוצר לא נמצא.');

    const productId = id ?? createEntityId('prod');
    if (id) await tx.product.update({ where: { id }, data });
    else await tx.product.create({ data: { ...data, id: productId } });

    await savePrices(tx, productId, prices, data.basePrice);
    await ctx.audit(tx, {
      entityType: 'Product',
      entityId: productId,
      action: id ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED',
      before: before ? { ...before, prices: before.priceListItems.map((item) => ({ priceListId: item.priceListId, price: item.price })) } : undefined,
      after: { ...data, prices },
    });
    return { productId };
  });
});

/** Explicit per-list prices win; otherwise the default price list gets the base price. */
async function savePrices(tx: TransactionClient, productId: string, prices: ProductInput['prices'], basePrice: number) {
  const targets = prices.length > 0
    ? prices
    : await tx.priceList.findMany({ where: { isDefault: true }, select: { id: true } }).then((lists) => lists.map((list) => ({ priceListId: list.id, price: basePrice })));

  for (const { priceListId, price } of targets) {
    await tx.priceListItem.upsert({
      where: { priceListId_productId: { priceListId, productId } },
      create: { priceListId, productId, price },
      update: { price },
    });
  }
}

export const toggleProductActiveAction = adminAction(activeToggleSchema, async ({ id, isActive }, ctx) => {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id }, select: { isActive: true } });
    if (!existing) throw new NotFoundError('המוצר לא נמצא.');
    await tx.product.update({ where: { id }, data: { isActive } });
    await ctx.audit(tx, { entityType: 'Product', entityId: id, action: isActive ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED', before: existing, after: { isActive } });
  });
  return { productId: id };
});

/** Inline edit from the products table. A new price applies to the base price and every price list. */
export const updateProductQuickAction = adminAction(quickProductUpdateSchema, async ({ id, basePrice, minQty }, ctx) => {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id }, select: { basePrice: true, minQty: true, orderMultiple: true } });
    if (!existing) throw new NotFoundError('המוצר לא נמצא.');

    if (basePrice !== undefined) await applyPriceToProducts(tx, [id], basePrice);
    if (minQty !== undefined) {
      await tx.product.update({ where: { id }, data: { minQty, orderMultiple: resolveOrderMultipleAfterMinQty(minQty, existing.orderMultiple) } });
    }
    await ctx.audit(tx, { entityType: 'Product', entityId: id, action: 'PRODUCT_QUICK_UPDATED', before: existing, after: { basePrice, minQty } });
  });
  return { productId: id };
});

export const bulkUpdateCategoryPricesAction = adminAction(bulkCategoryPriceSchema, async ({ category, price }, ctx) => {
  const updatedCount = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({ where: { category, isActive: true }, select: { id: true } });
    if (products.length === 0) throw new NotFoundError('אין מוצרים פעילים בקטגוריה הזו.');

    const productIds = products.map((product) => product.id);
    await applyPriceToProducts(tx, productIds, price);
    await ctx.audit(tx, { entityType: 'Product', entityId: category, action: 'PRODUCT_CATEGORY_PRICES_UPDATED', after: { category, price, productIds } });
    return productIds.length;
  });
  return { updatedCount, category };
});
