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
  sku?: string;
  recommended?: boolean;
  isRecommended?: boolean;
  isPreviousOrder?: boolean;
  promoLabel?: string;
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
  return getCartItems(cart).reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return sum + (product ? product.price * item.qty : 0);
  }, 0);
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
