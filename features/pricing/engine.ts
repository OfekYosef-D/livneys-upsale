export type PricingEffectType = 'DISPLAY_ONLY' | 'PERCENT_OFF' | 'FIXED_AMOUNT_OFF' | 'FIXED_UNIT_PRICE' | 'BUY_X_GET_Y';

export type PricingCustomer = {
  id: string;
  routeId: string;
  priceListId: string;
};

export type PricingRoute = {
  id: string;
};

export type PricingProduct = {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  isActive: boolean;
  minQty?: number;
};

export type PricingPriceListItem = {
  productId: string;
  price: number;
};

export type PricingPromotion = {
  id: string;
  title: string;
  tag: string;
  description: string;
  effectType: PricingEffectType;
  discountValue: number | null;
  buyQuantity: number | null;
  freeQuantity: number | null;
  priority: number;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  isActive: boolean;
  productIds: string[];
  categories: string[];
  customerIds: string[];
  routeIds: string[];
  priceListIds: string[];
};

export type AppliedPromotion = {
  id: string;
  title: string;
  tag: string;
  description: string;
  effectType: PricingEffectType;
  discountValue: number | null;
  buyQuantity: number | null;
  freeQuantity: number | null;
};

export type CatalogPricedProduct = PricingProduct & {
  listPrice: number;
  price: number;
  promoLabel?: string;
  promotion: AppliedPromotion | null;
};

export type OrderPricingItem = {
  productId: string;
  quantity: number;
};

export type OrderPricingLine = {
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

type PricingInput = {
  customer: PricingCustomer;
  route: PricingRoute;
  products: PricingProduct[];
  priceListItems: PricingPriceListItem[];
  promotions: PricingPromotion[];
  now?: Date;
};

export function resolveCatalogPricing({
  customer,
  route,
  products,
  priceListItems,
  promotions,
  now = new Date(),
}: PricingInput): { products: CatalogPricedProduct[] } {
  const pricesByProductId = new Map(priceListItems.map((item) => [item.productId, item.price]));
  const activeProducts = products.filter((product) => product.isActive);

  return {
    products: activeProducts.map((product) => {
      const listPrice = pricesByProductId.get(product.id) ?? product.basePrice;
      const eligiblePromotions = getEligiblePromotions({ customer, route, product, promotions, now });
      const selected = selectBestPromotion({
        promotions: eligiblePromotions,
        product,
        listUnitPrice: listPrice,
        quantity: product.minQty ?? 1,
      });
      const preview = selected ? calculateLineDiscount({ promotion: selected, listUnitPrice: listPrice, quantity: product.minQty ?? 1 }) : null;

      return {
        ...product,
        listPrice: roundCurrency(listPrice),
        price: roundCurrency(preview && selected && selected.effectType !== 'BUY_X_GET_Y' ? preview.unitPrice : listPrice),
        promoLabel: selected?.tag,
        promotion: selected ? toAppliedPromotion(selected) : null,
      };
    }),
  };
}

export function calculateOrderPricing({
  customer,
  route,
  products,
  priceListItems,
  items,
  promotions,
  now = new Date(),
}: PricingInput & { items: OrderPricingItem[] }): {
  lines: OrderPricingLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
} {
  const pricesByProductId = new Map(priceListItems.map((item) => [item.productId, item.price]));

  const lines = items
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product || !product.isActive) {
        throw new Error(`Unknown product ${item.productId}`);
      }

      const quantity = Math.floor(item.quantity);
      const minQty = product.minQty ?? 1;
      if (quantity < minQty) {
        throw new Error(`Minimum quantity for ${product.name} is ${minQty}`);
      }

      const listUnitPrice = pricesByProductId.get(product.id) ?? product.basePrice;
      const eligiblePromotions = getEligiblePromotions({ customer, route, product, promotions, now });
      const selected = selectBestPromotion({ promotions: eligiblePromotions, product, listUnitPrice, quantity });
      const discount = selected ? calculateLineDiscount({ promotion: selected, listUnitPrice, quantity }) : null;
      const lineSubtotal = roundCurrency(listUnitPrice * quantity);
      const discountTotal = roundCurrency(discount?.discountTotal ?? 0);
      const lineTotal = roundCurrency(lineSubtotal - discountTotal);

      return {
        productId: product.id,
        productName: product.name,
        quantity,
        listUnitPrice: roundCurrency(listUnitPrice),
        unitPrice: roundCurrency(discount?.unitPrice ?? listUnitPrice),
        lineSubtotal,
        discountTotal,
        lineTotal,
        promotionId: selected && discountTotal > 0 ? selected.id : null,
        promotionSnapshot: selected && discountTotal > 0 ? toAppliedPromotion(selected) : null,
      };
    });

  const subtotal = roundCurrency(lines.reduce((sum, line) => sum + line.lineSubtotal, 0));
  const discountTotal = roundCurrency(lines.reduce((sum, line) => sum + line.discountTotal, 0));

  return {
    lines,
    subtotal,
    discountTotal,
    total: roundCurrency(subtotal - discountTotal),
  };
}

function getEligiblePromotions({
  customer,
  route,
  product,
  promotions,
  now,
}: {
  customer: PricingCustomer;
  route: PricingRoute;
  product: PricingProduct;
  promotions: PricingPromotion[];
  now: Date;
}): PricingPromotion[] {
  return promotions.filter((promotion) => {
    if (!promotion.isActive) return false;
    if (!isPromotionInWindow(promotion, now)) return false;
    if (!matchesProductTarget(promotion, product)) return false;
    if (!matchesTarget(promotion.customerIds, customer.id)) return false;
    if (!matchesTarget(promotion.routeIds, route.id || customer.routeId)) return false;
    if (!matchesTarget(promotion.priceListIds, customer.priceListId)) return false;
    return true;
  });
}

function selectBestPromotion({
  promotions,
  product,
  listUnitPrice,
  quantity,
}: {
  promotions: PricingPromotion[];
  product: PricingProduct;
  listUnitPrice: number;
  quantity: number;
}): PricingPromotion | null {
  const ranked = promotions
    .map((promotion) => ({
      promotion,
      savings: calculateLineDiscount({ promotion, listUnitPrice, quantity }).discountTotal,
      endsAt: promotion.endsAt ? new Date(promotion.endsAt).getTime() : Number.POSITIVE_INFINITY,
    }))
    .filter(({ promotion, savings }) => promotion.effectType === 'DISPLAY_ONLY' || savings > 0)
    .sort((a, b) => {
      const byPriority = b.promotion.priority - a.promotion.priority;
      if (byPriority !== 0) return byPriority;

      const bySavings = b.savings - a.savings;
      if (bySavings !== 0) return bySavings;

      const byEnd = a.endsAt - b.endsAt;
      if (byEnd !== 0) return byEnd;

      return a.promotion.id.localeCompare(b.promotion.id);
    });

  if (!product.isActive) return null;
  return ranked[0]?.promotion ?? null;
}

function calculateLineDiscount({
  promotion,
  listUnitPrice,
  quantity,
}: {
  promotion: PricingPromotion;
  listUnitPrice: number;
  quantity: number;
}): { unitPrice: number; discountTotal: number } {
  if (promotion.effectType === 'DISPLAY_ONLY') {
    return { unitPrice: listUnitPrice, discountTotal: 0 };
  }

  if (promotion.effectType === 'PERCENT_OFF') {
    const percent = clamp(promotion.discountValue ?? 0, 0, 100);
    const unitDiscount = listUnitPrice * (percent / 100);
    return {
      unitPrice: roundCurrency(listUnitPrice - unitDiscount),
      discountTotal: roundCurrency(unitDiscount * quantity),
    };
  }

  if (promotion.effectType === 'FIXED_AMOUNT_OFF') {
    const unitDiscount = clamp(promotion.discountValue ?? 0, 0, listUnitPrice);
    return {
      unitPrice: roundCurrency(listUnitPrice - unitDiscount),
      discountTotal: roundCurrency(unitDiscount * quantity),
    };
  }

  if (promotion.effectType === 'FIXED_UNIT_PRICE') {
    const fixedPrice = clamp(promotion.discountValue ?? listUnitPrice, 0, listUnitPrice);
    return {
      unitPrice: roundCurrency(fixedPrice),
      discountTotal: roundCurrency((listUnitPrice - fixedPrice) * quantity),
    };
  }

  const buyQuantity = promotion.buyQuantity ?? 0;
  const freeQuantity = promotion.freeQuantity ?? 0;
  if (buyQuantity <= 0 || freeQuantity <= 0) {
    return { unitPrice: listUnitPrice, discountTotal: 0 };
  }

  const groupSize = buyQuantity + freeQuantity;
  const freeUnits = Math.floor(quantity / groupSize) * freeQuantity;
  return {
    unitPrice: roundCurrency(listUnitPrice),
    discountTotal: roundCurrency(freeUnits * listUnitPrice),
  };
}

function isPromotionInWindow(promotion: PricingPromotion, now: Date): boolean {
  const nowTime = now.getTime();
  const startsAt = promotion.startsAt ? new Date(promotion.startsAt).getTime() : Number.NEGATIVE_INFINITY;
  const endsAt = promotion.endsAt ? new Date(promotion.endsAt).getTime() : Number.POSITIVE_INFINITY;
  return startsAt <= nowTime && nowTime <= endsAt;
}

function matchesProductTarget(promotion: PricingPromotion, product: PricingProduct): boolean {
  const hasProductTargets = promotion.productIds.length > 0;
  const hasCategoryTargets = promotion.categories.length > 0;
  if (!hasProductTargets && !hasCategoryTargets) return true;
  return promotion.productIds.includes(product.id) || promotion.categories.includes(product.category);
}

function matchesTarget(targets: string[], value: string): boolean {
  return targets.length === 0 || targets.includes(value);
}

function toAppliedPromotion(promotion: PricingPromotion): AppliedPromotion {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
