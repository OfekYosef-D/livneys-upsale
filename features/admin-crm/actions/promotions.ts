'use server';

import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { createEntityId } from '@/lib/ids';
import { adminAction } from '@/lib/server-action';
import { assertAllExist } from '../guards';
import { activeToggleSchema, promotionSchema } from '../schemas';

export const savePromotionAction = adminAction(promotionSchema, async (input, ctx) => {
  const { id, productIds, categories, customerIds, routeIds, priceListIds, buyQuantity, freeQuantity, ...data } = input;
  await Promise.all([
    assertAllExist('product', productIds),
    assertAllExist('customer', customerIds),
    assertAllExist('route', routeIds),
    assertAllExist('priceList', priceListIds),
  ]);

  return prisma.$transaction(async (tx) => {
    const before = id ? await tx.promotion.findUnique({ where: { id } }) : null;
    if (id && !before) throw new NotFoundError('המבצע לא נמצא.');

    const promotionId = id ?? createEntityId('promo');
    const record = {
      ...data,
      // The legacy single-product column is kept in sync for older reports.
      productId: productIds[0] ?? null,
      buyQuantity: buyQuantity === null ? null : Math.floor(buyQuantity),
      freeQuantity: freeQuantity === null ? null : Math.floor(freeQuantity),
    };
    if (id) await tx.promotion.update({ where: { id }, data: record });
    else await tx.promotion.create({ data: { ...record, id: promotionId } });

    // Targets are replaced wholesale: an empty list means "applies to everyone".
    await Promise.all([
      tx.promotionProductTarget.deleteMany({ where: { promotionId } }),
      tx.promotionCategoryTarget.deleteMany({ where: { promotionId } }),
      tx.promotionCustomerTarget.deleteMany({ where: { promotionId } }),
      tx.promotionRouteTarget.deleteMany({ where: { promotionId } }),
      tx.promotionPriceListTarget.deleteMany({ where: { promotionId } }),
    ]);
    await Promise.all([
      tx.promotionProductTarget.createMany({ data: productIds.map((productId) => ({ promotionId, productId })) }),
      tx.promotionCategoryTarget.createMany({ data: categories.map((category) => ({ promotionId, category })) }),
      tx.promotionCustomerTarget.createMany({ data: customerIds.map((customerId) => ({ promotionId, customerId })) }),
      tx.promotionRouteTarget.createMany({ data: routeIds.map((routeId) => ({ promotionId, routeId })) }),
      tx.promotionPriceListTarget.createMany({ data: priceListIds.map((priceListId) => ({ promotionId, priceListId })) }),
    ]);

    await ctx.audit(tx, {
      entityType: 'Promotion',
      entityId: promotionId,
      action: id ? 'PROMOTION_UPDATED' : 'PROMOTION_CREATED',
      before: before ?? undefined,
      after: input,
    });
    return { promotionId };
  });
});

export const togglePromotionActiveAction = adminAction(activeToggleSchema, async ({ id, isActive }, ctx) => {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.promotion.findUnique({ where: { id }, select: { isActive: true } });
    if (!existing) throw new NotFoundError('המבצע לא נמצא.');
    await tx.promotion.update({ where: { id }, data: { isActive } });
    await ctx.audit(tx, { entityType: 'Promotion', entityId: id, action: isActive ? 'PROMOTION_ACTIVATED' : 'PROMOTION_DEACTIVATED', before: existing, after: { isActive } });
  });
  return { promotionId: id };
});
