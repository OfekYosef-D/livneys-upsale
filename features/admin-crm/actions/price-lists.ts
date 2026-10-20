'use server';

import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { createEntityId } from '@/lib/ids';
import { adminAction } from '@/lib/server-action';
import { assertAllExist } from '../guards';
import { clonePriceListSchema, priceListSchema } from '../schemas';

export const savePriceListAction = adminAction(priceListSchema, async ({ id, prices, ...data }, ctx) => {
  await assertAllExist('product', prices.map((item) => item.productId));

  return prisma.$transaction(async (tx) => {
    const before = id ? await tx.priceList.findUnique({ where: { id }, include: { items: true } }) : null;
    if (id && !before) throw new NotFoundError('המחירון לא נמצא.');

    const priceListId = id ?? createEntityId('price-list');
    // Exactly one price list is the default (used for new products and new customers).
    if (data.isDefault) await tx.priceList.updateMany({ where: { id: { not: priceListId } }, data: { isDefault: false } });

    if (id) await tx.priceList.update({ where: { id }, data });
    else await tx.priceList.create({ data: { ...data, id: priceListId } });

    for (const { productId, price } of prices) {
      await tx.priceListItem.upsert({
        where: { priceListId_productId: { priceListId, productId } },
        create: { priceListId, productId, price },
        update: { price },
      });
    }

    await ctx.audit(tx, {
      entityType: 'PriceList',
      entityId: priceListId,
      action: id ? 'PRICE_LIST_UPDATED' : 'PRICE_LIST_CREATED',
      before: before ? { ...before, prices: before.items.map((item) => ({ productId: item.productId, price: item.price })) } : undefined,
      after: { ...data, prices },
    });
    return { priceListId };
  });
});

export const clonePriceListAction = adminAction(clonePriceListSchema, async ({ id, name }, ctx) => {
  return prisma.$transaction(async (tx) => {
    const source = await tx.priceList.findUnique({ where: { id }, include: { items: true } });
    if (!source) throw new NotFoundError('המחירון לא נמצא.');

    const priceListId = createEntityId('price-list');
    await tx.priceList.create({
      data: {
        id: priceListId,
        name,
        description: source.description,
        isDefault: false,
        items: { create: source.items.map((item) => ({ productId: item.productId, price: item.price })) },
      },
    });
    await ctx.audit(tx, { entityType: 'PriceList', entityId: priceListId, action: 'PRICE_LIST_CLONED', after: { sourcePriceListId: id, name } });
    return { priceListId };
  });
});
