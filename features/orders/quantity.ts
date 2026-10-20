import { ValidationError } from '@/lib/errors';

/** Ordering constraints of a product: a minimum quantity and a case multiple (e.g. sold in sixes). */
export type QuantityRules = {
  id: string;
  name: string;
  minQty?: number | null;
  orderMultiple?: number | null;
};

export type OrderItem = { productId: string; quantity: number };

export function getOrderMultiple(product: Pick<QuantityRules, 'orderMultiple'>): number {
  return Math.max(1, Math.floor(product.orderMultiple ?? 1));
}

export function getMinimumQuantity(product: Pick<QuantityRules, 'minQty'>): number {
  return Math.max(1, Math.floor(product.minQty ?? 1));
}

/** The smallest valid quantity: at least the minimum and a whole number of cases. */
export function getFirstValidQuantity(product: Pick<QuantityRules, 'minQty' | 'orderMultiple'>): number {
  const multiple = getOrderMultiple(product);
  return Math.ceil(getMinimumQuantity(product) / multiple) * multiple;
}

/** Rounds a requested quantity up to the nearest valid one (0 stays 0). */
export function roundUpToValidQuantity(product: Pick<QuantityRules, 'minQty' | 'orderMultiple'>, quantity: number): number {
  if (quantity <= 0) return 0;
  const multiple = getOrderMultiple(product);
  return Math.max(getFirstValidQuantity(product), Math.ceil(quantity / multiple) * multiple);
}

/** Returns a Hebrew explanation when the quantity breaks the product rules, otherwise null. */
export function getQuantityError(product: QuantityRules, quantity: number): string | null {
  const minQty = getMinimumQuantity(product);
  if (quantity < minQty) return `הכמות המינימלית עבור ${product.name} היא ${minQty}.`;

  const multiple = getOrderMultiple(product);
  if (quantity % multiple !== 0) return `הכמות עבור ${product.name} חייבת להיות בכפולות של ${multiple}.`;

  return null;
}

export function assertValidQuantity(product: QuantityRules, quantity: number): void {
  const error = getQuantityError(product, quantity);
  if (error) throw new ValidationError(error);
}

/**
 * Drops empty lines and lines for products that are no longer orderable, merges duplicates,
 * and validates the remaining quantities against each product's rules.
 */
export function normalizeOrderItems(items: readonly OrderItem[], products: readonly QuantityRules[]): OrderItem[] {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const quantities = new Map<string, number>();

  for (const item of items) {
    const quantity = Math.floor(item.quantity);
    if (quantity <= 0 || !productsById.has(item.productId)) continue;
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + quantity);
  }

  return [...quantities].map(([productId, quantity]) => {
    assertValidQuantity(productsById.get(productId)!, quantity);
    return { productId, quantity };
  });
}
