export type Cart = Record<string, number>;

export type OrderLine = {
  productId: string;
  qty: number;
};

export type CartProductConstraints = {
  id: string;
  minQty?: number;
  orderMultiple?: number;
};

export type PreparedCustomerCart = {
  cart: Cart;
  removedUnavailableCount: number;
  adjustedBelowMinimumCount: number;
  adjustedToMultipleCount: number;
};

export const REMOVED_UNAVAILABLE_CART_ITEMS_MESSAGE =
  'חלק מהמוצרים מההזמנה הקודמת אינם זמינים עוד והוסרו מהסל.';

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

export function getAllowedProductIds(products: CartProductConstraints[]): Set<string> {
  return new Set(products.map((product) => product.id));
}

export function buildCartFromOrder(items: OrderLine[], allowedProductIds?: Set<string>): Cart {
  return items.reduce<Cart>((cart, item) => {
    if (allowedProductIds && !allowedProductIds.has(item.productId)) {
      return cart;
    }

    return setCartQuantity(cart, item.productId, item.qty);
  }, {});
}

export function sanitizeCart(cart: Cart, allowedProductIds: Set<string>): { cart: Cart; removedProductIds: string[] } {
  const removedProductIds: string[] = [];
  const next: Cart = {};

  for (const [productId, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;

    if (!allowedProductIds.has(productId)) {
      removedProductIds.push(productId);
      continue;
    }

    next[productId] = qty;
  }

  return { cart: next, removedProductIds };
}

export function enforceCartMinimums<T extends CartProductConstraints>(cart: Cart, products: T[]): { cart: Cart; adjustedProductIds: string[] } {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const adjustedProductIds: string[] = [];
  let next = cart;

  for (const [productId, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;

    const product = productsById.get(productId);
    if (!product) continue;

    const minQty = product.minQty ?? 1;
    if (qty < minQty) {
      adjustedProductIds.push(productId);
      next = setCartQuantity(next, productId, minQty);
    }
  }

  return { cart: next, adjustedProductIds };
}

export function enforceCartMultiples<T extends CartProductConstraints>(cart: Cart, products: T[]): { cart: Cart; adjustedProductIds: string[] } {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const adjustedProductIds: string[] = [];
  let next = cart;

  for (const [productId, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;

    const product = productsById.get(productId);
    if (!product) continue;

    const multiple = Math.max(1, Math.floor(product.orderMultiple ?? 1));
    if (multiple <= 1 || qty % multiple === 0) continue;

    adjustedProductIds.push(productId);
    next = setCartQuantity(next, productId, Math.ceil(qty / multiple) * multiple);
  }

  return { cart: next, adjustedProductIds };
}

export function prepareCustomerCart(orderItems: OrderLine[], products: CartProductConstraints[]): PreparedCustomerCart {
  const allowedProductIds = getAllowedProductIds(products);
  const removedUnavailableCount = orderItems.filter((item) => item.qty > 0 && !allowedProductIds.has(item.productId)).length;
  const seededCart = buildCartFromOrder(orderItems, allowedProductIds);
  const { cart: minimumCart, adjustedProductIds } = enforceCartMinimums(seededCart, products);
  const { cart: multipleCart, adjustedProductIds: multipleAdjustedProductIds } = enforceCartMultiples(minimumCart, products);

  return {
    cart: multipleCart,
    removedUnavailableCount,
    adjustedBelowMinimumCount: adjustedProductIds.length,
    adjustedToMultipleCount: multipleAdjustedProductIds.length,
  };
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

export function getCartItems(cart: Cart, allowedProductIds?: Set<string>): OrderLine[] {
  return Object.entries(cart)
    .filter(([productId, qty]) => qty > 0 && (!allowedProductIds || allowedProductIds.has(productId)))
    .map(([productId, qty]) => ({ productId, qty }));
}

export function getCartTotal<T extends CatalogProductLike>(cart: Cart, products: T[]): number {
  return getCartPricingSummary(cart, products).total;
}

export function getCartPricingSummary<T extends CatalogProductLike>(cart: Cart, products: T[]): { subtotal: number; discountTotal: number; total: number } {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const allowedProductIds = getAllowedProductIds(products);

  return getCartItems(cart, allowedProductIds).reduce((summary, item) => {
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

export function getIncrementalCartPricingSummary<T extends CatalogProductLike>(
  cart: Cart,
  products: T[],
  existingItems: OrderLine[],
): { subtotal: number; discountTotal: number; total: number } {
  const allowedProductIds = getAllowedProductIds(products);
  const existingCart = buildCartFromOrder(existingItems, allowedProductIds);
  const combinedCart = getCartItems(cart, allowedProductIds).reduce(
    (combined, item) => setCartQuantity(combined, item.productId, (combined[item.productId] ?? 0) + item.qty),
    existingCart,
  );
  const baseline = getCartPricingSummary(existingCart, products);
  const combined = getCartPricingSummary(combinedCart, products);

  return {
    subtotal: roundCurrency(combined.subtotal - baseline.subtotal),
    discountTotal: Math.max(0, roundCurrency(combined.discountTotal - baseline.discountTotal)),
    total: Math.max(0, roundCurrency(combined.total - baseline.total)),
  };
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
