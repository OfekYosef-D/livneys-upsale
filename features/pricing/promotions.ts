import type { Prisma, PrismaClient } from '@prisma/client';
import type { PricingPromotion } from './engine';

export const promotionTargetsInclude = {
  productTargets: true,
  categoryTargets: true,
  customerTargets: true,
  routeTargets: true,
  priceListTargets: true,
} satisfies Prisma.PromotionInclude;

type PromotionWithTargets = Prisma.PromotionGetPayload<{ include: typeof promotionTargetsInclude }>;

/** The legacy single `productId` column and the product target table both mean "applies to this product". */
export function getPromotionProductIds(promotion: { productId: string | null; productTargets: Array<{ productId: string }> }): string[] {
  return [...new Set([promotion.productId, ...promotion.productTargets.map((target) => target.productId)].filter((id): id is string => Boolean(id)))];
}

export function toPricingPromotion(promotion: PromotionWithTargets): PricingPromotion {
  return {
    id: promotion.id,
    title: promotion.title,
    tag: promotion.tag,
    description: promotion.description,
    effectType: promotion.effectType,
    discountValue: promotion.discountValue === null ? null : Number(promotion.discountValue),
    buyQuantity: promotion.buyQuantity,
    freeQuantity: promotion.freeQuantity,
    priority: promotion.priority,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    isActive: promotion.isActive,
    productIds: getPromotionProductIds(promotion),
    categories: promotion.categoryTargets.map((target) => target.category),
    customerIds: promotion.customerTargets.map((target) => target.customerId),
    routeIds: promotion.routeTargets.map((target) => target.routeId),
    priceListIds: promotion.priceListTargets.map((target) => target.priceListId),
  };
}

export async function loadActivePromotions(db: Pick<PrismaClient, 'promotion'>): Promise<PricingPromotion[]> {
  const promotions = await db.promotion.findMany({ where: { isActive: true }, include: promotionTargetsInclude });
  return promotions.map(toPricingPromotion);
}
