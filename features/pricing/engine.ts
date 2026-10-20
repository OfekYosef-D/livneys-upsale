import type { PromotionEffectType } from '@prisma/client';
import { NotFoundError } from '@/lib/errors';
import { clamp, roundCurrency, sumCurrency } from '@/lib/money';
import { assertValidQuantity, getFirstValidQuantity, type OrderItem } from '../orders/quantity';

/**
 * Pure pricing rules shared by the server (authoritative order snapshots) and the
 * browser (live cart preview). No I/O happens here.
 *
 * Price resolution per product: customer price list → product base price → best eligible
 * promotion (highest priority, then highest saving, then soonest to end).
 */

export type { PromotionEffectType };

export type PricingProduct = {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  isActive: boolean;
  minQty?: number;
  orderMultiple?: number;
};

export type PricingTarget = {
  customerId: string;
  routeId: string;
  priceListId: string;
};

/** The parts of a promotion needed to compute a discount. */
export type PromotionRule = {
  effectType: PromotionEffectType;
  discountValue: number | null;
  buyQuantity: number | null;
  freeQuantity: number | null;
};

export type AppliedPromotion = PromotionRule & {
  id: string;
  title: string;
  tag: string;
  description: string;
};

export type PricingPromotion = AppliedPromotion & {
  priority: number;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  isActive: boolean;
  /** Empty target lists mean "applies to all". */
  productIds: string[];
  categories: string[];
  customerIds: string[];
  routeIds: string[];
  priceListIds: string[];
};

export type PricedLine = {
  productId: string;
  productName: string;
  quantity: number;
  listUnitPrice: number;
  unitPrice: number;
  lineSubtotal: number;
  discountTotal: number;
  lineTotal: number;
  promotionId: string | null;
  promotionSnapshot: AppliedPromotion | null;
};

export type PricingSummary = {
  subtotal: number;
  discountTotal: number;
  total: number;
};

export type CatalogPrice = {
  productId: string;
  listPrice: number;
  /** Effective unit price at the product's first valid quantity (bundle deals keep the list price). */
  price: number;
  promoLabel?: string;
  promotion: AppliedPromotion | null;
};

type PricingInput = {
  target: PricingTarget;
  products: PricingProduct[];
  priceListItems: Array<{ productId: string; price: number }>;
  promotions: PricingPromotion[];
  now?: Date;
};

/** Discount for `quantity` units of one product under a single promotion rule. */
export function applyPromotion(
  promotion: PromotionRule,
  listUnitPrice: number,
  quantity: number,
): { unitPrice: number; discountTotal: number } {
  switch (promotion.effectType) {
    case 'PERCENT_OFF': {
      const unitDiscount = listUnitPrice * (clamp(promotion.discountValue ?? 0, 0, 100) / 100);
      return { unitPrice: roundCurrency(listUnitPrice - unitDiscount), discountTotal: roundCurrency(unitDiscount * quantity) };
    }
    case 'FIXED_AMOUNT_OFF': {
      const unitDiscount = clamp(promotion.discountValue ?? 0, 0, listUnitPrice);
      return { unitPrice: roundCurrency(listUnitPrice - unitDiscount), discountTotal: roundCurrency(unitDiscount * quantity) };
    }
    case 'FIXED_UNIT_PRICE': {
      const fixedPrice = clamp(promotion.discountValue ?? listUnitPrice, 0, listUnitPrice);
      return { unitPrice: roundCurrency(fixedPrice), discountTotal: roundCurrency((listUnitPrice - fixedPrice) * quantity) };
    }
    case 'BUY_X_GET_Y': {
      const buy = promotion.buyQuantity ?? 0;
      const free = promotion.freeQuantity ?? 0;
      if (buy <= 0 || free <= 0) return { unitPrice: listUnitPrice, discountTotal: 0 };
      const freeUnits = Math.floor(quantity / (buy + free)) * free;
      return { unitPrice: roundCurrency(listUnitPrice), discountTotal: roundCurrency(freeUnits * listUnitPrice) };
    }
    case 'DISPLAY_ONLY':
      return { unitPrice: listUnitPrice, discountTotal: 0 };
  }
}

/** Builds a priced line; with no promotion (or a non-saving one) the list price applies. */
export function priceLine({
  productId,
  productName,
  listUnitPrice,
  quantity,
  promotion,
}: {
  productId: string;
  productName: string;
  listUnitPrice: number;
  quantity: number;
  promotion: AppliedPromotion | null;
}): PricedLine {
  const discount = promotion ? applyPromotion(promotion, listUnitPrice, quantity) : null;
  const lineSubtotal = roundCurrency(listUnitPrice * quantity);
  const discountTotal = discount?.discountTotal ?? 0;
  const hasSaving = discountTotal > 0;

  return {
    productId,
    productName,
    quantity,
    listUnitPrice: roundCurrency(listUnitPrice),
    unitPrice: roundCurrency(discount?.unitPrice ?? listUnitPrice),
    lineSubtotal,
    discountTotal,
    lineTotal: roundCurrency(lineSubtotal - discountTotal),
    promotionId: hasSaving ? promotion!.id : null,
    promotionSnapshot: hasSaving ? toAppliedPromotion(promotion!) : null,
  };
}

export function summarizeLines(lines: readonly Pick<PricedLine, 'lineSubtotal' | 'discountTotal'>[]): PricingSummary {
  const subtotal = sumCurrency(lines, (line) => line.lineSubtotal);
  const discountTotal = sumCurrency(lines, (line) => line.discountTotal);
  return { subtotal, discountTotal, total: roundCurrency(subtotal - discountTotal) };
}

/** Display prices for a customer's catalog. */
export function resolveCatalogPricing({ target, products, priceListItems, promotions, now = new Date() }: PricingInput): CatalogPrice[] {
  const listPrices = new Map(priceListItems.map((item) => [item.productId, item.price]));

  return products
    .filter((product) => product.isActive)
    .map((product) => {
      const listPrice = listPrices.get(product.id) ?? product.basePrice;
      const previewQuantity = getFirstValidQuantity(product);
      const promotion = selectBestPromotion({ product, target, promotions, now, listUnitPrice: listPrice, quantity: previewQuantity });
      const preview = promotion && promotion.effectType !== 'BUY_X_GET_Y'
        ? applyPromotion(promotion, listPrice, previewQuantity).unitPrice
        : listPrice;

      return {
        productId: product.id,
        listPrice: roundCurrency(listPrice),
        price: roundCurrency(preview),
        promoLabel: promotion?.tag,
        promotion: promotion ? toAppliedPromotion(promotion) : null,
      };
    });
}

/** Authoritative order pricing. Throws when a product is unavailable or a quantity breaks its rules. */
export function calculateOrderPricing({
  target,
  products,
  priceListItems,
  promotions,
  items,
  now = new Date(),
}: PricingInput & { items: OrderItem[] }): PricingSummary & { lines: PricedLine[] } {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const listPrices = new Map(priceListItems.map((item) => [item.productId, item.price]));

  const lines = items
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const product = productsById.get(item.productId);
      if (!product?.isActive) throw new NotFoundError('המוצר המבוקש אינו זמין להזמנה.');

      const quantity = Math.floor(item.quantity);
      assertValidQuantity(product, quantity);

      const listUnitPrice = listPrices.get(product.id) ?? product.basePrice;
      const promotion = selectBestPromotion({ product, target, promotions, now, listUnitPrice, quantity });
      return priceLine({ productId: product.id, productName: product.name, listUnitPrice, quantity, promotion });
    });

  return { lines, ...summarizeLines(lines) };
}

function selectBestPromotion({
  product,
  target,
  promotions,
  now,
  listUnitPrice,
  quantity,
}: {
  product: PricingProduct;
  target: PricingTarget;
  promotions: PricingPromotion[];
  now: Date;
  listUnitPrice: number;
  quantity: number;
}): PricingPromotion | null {
  if (!product.isActive) return null;

  const ranked = promotions
    .filter((promotion) => isEligible(promotion, product, target, now))
    .map((promotion) => ({
      promotion,
      savings: applyPromotion(promotion, listUnitPrice, quantity).discountTotal,
      endsAt: promotion.endsAt ? new Date(promotion.endsAt).getTime() : Number.POSITIVE_INFINITY,
    }))
    .filter(({ promotion, savings }) => promotion.effectType === 'DISPLAY_ONLY' || savings > 0)
    .sort((a, b) =>
      b.promotion.priority - a.promotion.priority
      || b.savings - a.savings
      || a.endsAt - b.endsAt
      || a.promotion.id.localeCompare(b.promotion.id));

  return ranked[0]?.promotion ?? null;
}

function isEligible(promotion: PricingPromotion, product: PricingProduct, target: PricingTarget, now: Date): boolean {
  const time = now.getTime();
  const startsAt = promotion.startsAt ? new Date(promotion.startsAt).getTime() : Number.NEGATIVE_INFINITY;
  const endsAt = promotion.endsAt ? new Date(promotion.endsAt).getTime() : Number.POSITIVE_INFINITY;
  const targetsProduct = (promotion.productIds.length === 0 && promotion.categories.length === 0)
    || promotion.productIds.includes(product.id)
    || promotion.categories.includes(product.category);

  return promotion.isActive
    && startsAt <= time
    && time <= endsAt
    && targetsProduct
    && matchesTarget(promotion.customerIds, target.customerId)
    && matchesTarget(promotion.routeIds, target.routeId)
    && matchesTarget(promotion.priceListIds, target.priceListId);
}

function matchesTarget(targets: string[], value: string): boolean {
  return targets.length === 0 || targets.includes(value);
}

function toAppliedPromotion(promotion: AppliedPromotion): AppliedPromotion {
  return {
    id: promotion.id,
    title: promotion.title,
    tag: promotion.tag,
    description: promotion.description,
    effectType: promotion.effectType,
    discountValue: promotion.discountValue,
    buyQuantity: promotion.buyQuantity,
    freeQuantity: promotion.freeQuantity,
  };
}
