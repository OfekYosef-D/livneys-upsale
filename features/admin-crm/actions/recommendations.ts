'use server';

import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { adminAction } from '@/lib/server-action';
import { activeToggleSchema, recommendationSchema } from '../schemas';

/** Hand-picked "recommended for you" products shown to a customer in the catalog. */
export const saveRecommendationAction = adminAction(recommendationSchema, async ({ id, ...data }, ctx) => {
  const [customer, product] = await Promise.all([
    prisma.customer.findUnique({ where: { id: data.customerId }, select: { isActive: true } }),
    prisma.product.findUnique({ where: { id: data.productId }, select: { isActive: true } }),
  ]);
  if (!customer?.isActive) throw new NotFoundError('הלקוח לא נמצא או אינו פעיל.');
  if (!product?.isActive) throw new NotFoundError('המוצר לא נמצא או אינו פעיל.');

  return prisma.$transaction(async (tx) => {
    const recommendation = id
      ? await tx.customerProductRecommendation.update({ where: { id }, data })
      : await tx.customerProductRecommendation.upsert({
          where: { customerId_productId: { customerId: data.customerId, productId: data.productId } },
          create: data,
          update: { reason: data.reason, isActive: data.isActive },
        });
    await ctx.audit(tx, {
      customerId: data.customerId,
      entityType: 'Recommendation',
      entityId: recommendation.id,
      action: id ? 'RECOMMENDATION_UPDATED' : 'RECOMMENDATION_SAVED',
      after: data,
    });
    return { recommendationId: recommendation.id };
  });
});

export const toggleRecommendationActiveAction = adminAction(activeToggleSchema, async ({ id, isActive }, ctx) => {
  await prisma.$transaction(async (tx) => {
    const recommendation = await tx.customerProductRecommendation.update({ where: { id }, data: { isActive } });
    await ctx.audit(tx, {
      customerId: recommendation.customerId,
      entityType: 'Recommendation',
      entityId: id,
      action: isActive ? 'RECOMMENDATION_ACTIVATED' : 'RECOMMENDATION_DEACTIVATED',
      after: { isActive },
    });
  });
  return { recommendationId: id };
});
