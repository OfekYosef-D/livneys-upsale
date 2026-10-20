import { roundCurrency } from '@/lib/money';
import type { CatalogProduct } from '../catalog/customer-catalog';
import { roundUpToValidQuantity, type OrderItem } from '../orders/quantity';
import { priceLine, summarizeLines, type PricedLine, type PricingSummary } from '../pricing/engine';

/** productId → quantity. Lives in the browser; the server re-prices everything on submit. */
export type Cart = Record<string, number>;

export type CartProduct = Pick<CatalogProduct, 'id' | 'name' | 'sku' | 'category' | 'listPrice' | 'promotion' | 'minQty' | 'orderMultiple'>;

export type CartAdjustments = {
  removedUnavailable: number;
  adjustedQuantities: number;
};

export function setCartQuantity(cart: Cart, productId: string, quantity: number): Cart {
  const next = { ...cart };
  const normalized = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  if (normalized === 0) delete next[productId];
  else next[productId] = normalized;
  return next;
}

export function getCartItems(cart: Cart): OrderItem[] {
  return Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Seeds a cart from a previous order or a saved draft. Products that are no longer sold are
 * dropped and quantities are rounded up to the current minimum / case multiple.
 */
export function createCartFromLines(
  lines: ReadonlyArray<{ productId: string | null; quantity: number }>,
  products: readonly CartProduct[],
): { cart: Cart; adjustments: CartAdjustments } {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const adjustments: CartAdjustments = { removedUnavailable: 0, adjustedQuantities: 0 };
  let cart: Cart = {};

  for (const line of lines) {
    if (!line.productId || line.quantity <= 0) continue;
    const product = productsById.get(line.productId);
    if (!product) {
      adjustments.removedUnavailable += 1;
      continue;
    }
    const quantity = roundUpToValidQuantity(product, line.quantity);
    if (quantity !== line.quantity) adjustments.adjustedQuantities += 1;
    cart = setCartQuantity(cart, product.id, (cart[product.id] ?? 0) + quantity);
  }

  return { cart, adjustments };
}

export function describeCartAdjustments(adjustments: CartAdjustments): string | null {
  if (adjustments.removedUnavailable > 0) return 'חלק מהמוצרים מההזמנה הקודמת אינם זמינים עוד והוסרו מהסל.';
  if (adjustments.adjustedQuantities > 0) return 'הכמויות של חלק מהמוצרים עודכנו לכמות המינימלית או לכפולות הארגז הנוכחיות.';
  return null;
}

/** Live preview using the same pricing rules as the server. */
export function priceCart(cart: Cart, products: readonly CartProduct[]): PricingSummary & { lines: PricedLine[] } {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const lines = getCartItems(cart).flatMap((item) => {
    const product = productsById.get(item.productId);
    return product
      ? [priceLine({
          productId: product.id,
          productName: product.name,
          listUnitPrice: product.listPrice,
          quantity: item.quantity,
          promotion: product.promotion,
        })]
      : [];
  });
  return { lines, ...summarizeLines(lines) };
}

/** The extra cost of adding `cart` on top of an existing order (bundle deals count combined quantities). */
export function priceCartIncrement(cart: Cart, products: readonly CartProduct[], existing: readonly OrderItem[]): PricingSummary {
  const existingCart = existing.reduce<Cart>((acc, item) => setCartQuantity(acc, item.productId, (acc[item.productId] ?? 0) + item.quantity), {});
  const combinedCart = getCartItems(cart).reduce<Cart>(
    (acc, item) => setCartQuantity(acc, item.productId, (acc[item.productId] ?? 0) + item.quantity),
    existingCart,
  );
  const baseline = priceCart(existingCart, products);
  const combined = priceCart(combinedCart, products);
  return {
    subtotal: roundCurrency(combined.subtotal - baseline.subtotal),
    discountTotal: Math.max(0, roundCurrency(combined.discountTotal - baseline.discountTotal)),
    total: Math.max(0, roundCurrency(combined.total - baseline.total)),
  };
}

export function filterCatalog<T extends Pick<CartProduct, 'name' | 'category' | 'sku'>>(
  products: readonly T[],
  { category, query }: { category: string; query: string },
): T[] {
  const needle = query.trim().toLocaleLowerCase('he-IL');
  return products.filter((product) =>
    (category === 'all' || product.category === category)
    && (!needle || `${product.name} ${product.category} ${product.sku}`.toLocaleLowerCase('he-IL').includes(needle)));
}
