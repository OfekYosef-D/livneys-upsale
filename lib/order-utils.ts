export type Cart = Record<string, number>;

export type OrderLine = {
  productId: string;
  qty: number;
};

export type CatalogProductLike = {
  id: string;
  name: string;
  category: string;
  price: number;
  listPrice?: number;
  sku?: string;
  recommended?: boolean;
  isRecommended?: boolean;
  isPreviousOrder?: boolean;
  promoLabel?: string;
  promotion?: {
    effectType: 'DISPLAY_ONLY' | 'PERCENT_OFF' | 'FIXED_AMOUNT_OFF' | 'FIXED_UNIT_PRICE' | 'BUY_X_GET_Y';
    discountValue: number | null;
    buyQuantity: number | null;
    freeQuantity: number | null;
  } | null;
};

export type CatalogSegment = 'all' | 'previous' | 'recommended' | 'promotions';

export type CatalogFilters = {
  category?: string;
  query?: string;
  segment?: CatalogSegment;
};

export function buildCartFromOrder(items: OrderLine[]): Cart {
  return items.reduce<Cart>((cart, item) => setCartQuantity(cart, item.productId, item.qty), {});
}

export function setCartQuantity(cart: Cart, productId: string, qty: number): Cart {
  const next = { ...cart };
  const normalized = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;

  if (normalized === 0) {
    delete next[productId];
    return next;
  }

  next[productId] = normalized;
  return next;
}

export function getCartItems(cart: Cart): OrderLine[] {
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => ({ productId, qty }));
}

export function getCartTotal<T extends CatalogProductLike>(cart: Cart, products: T[]): number {
  return getCartPricingSummary(cart, products).total;
}

export function getCartPricingSummary<T extends CatalogProductLike>(cart: Cart, products: T[]): { subtotal: number; discountTotal: number; total: number } {
  const productsById = new Map(products.map((product) => [product.id, product]));

  return getCartItems(cart).reduce((summary, item) => {
    const product = productsById.get(item.productId);
    if (!product) return summary;

    const listPrice = product.listPrice ?? product.price;
    const lineSubtotal = listPrice * item.qty;
    const lineTotal = getDiscountedLineTotal(product, item.qty, listPrice);

    return {
      subtotal: roundCurrency(summary.subtotal + lineSubtotal),
      discountTotal: roundCurrency(summary.discountTotal + Math.max(0, lineSubtotal - lineTotal)),
      total: roundCurrency(summary.total + lineTotal),
    };
  }, { subtotal: 0, discountTotal: 0, total: 0 });
}

export function filterCatalogProducts<T extends CatalogProductLike>(products: T[], filters: CatalogFilters): T[] {
  const query = normalize(filters.query ?? '');

  return products.filter((product) => {
    const matchesCategory = !filters.category || filters.category === 'all' || product.category === filters.category;
    const matchesQuery =
      query.length === 0 ||
      normalize(`${product.name} ${product.category} ${product.sku ?? ''}`).includes(query);
    const matchesSegment =
      !filters.segment ||
      filters.segment === 'all' ||
      (filters.segment === 'previous' && product.isPreviousOrder) ||
      (filters.segment === 'recommended' && (product.isRecommended ?? product.recommended)) ||
      (filters.segment === 'promotions' && Boolean(product.promoLabel));

    return matchesCategory && matchesQuery && matchesSegment;
  });
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('he-IL');
}

function getDiscountedLineTotal(product: CatalogProductLike, quantity: number, listPrice: number): number {
  const promotion = product.promotion;
  if (!promotion || promotion.effectType === 'DISPLAY_ONLY') {
    return product.price * quantity;
  }

  if (promotion.effectType === 'BUY_X_GET_Y') {
    const buyQuantity = promotion.buyQuantity ?? 0;
    const freeQuantity = promotion.freeQuantity ?? 0;
    if (buyQuantity <= 0 || freeQuantity <= 0) return listPrice * quantity;

    const freeUnits = Math.floor(quantity / (buyQuantity + freeQuantity)) * freeQuantity;
    return roundCurrency((quantity - freeUnits) * listPrice);
  }

  return roundCurrency(product.price * quantity);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
