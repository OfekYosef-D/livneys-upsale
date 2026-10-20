'use client';

import { useMemo, useState } from 'react';
import type { CartSeed } from '../customer-portal/types';
import { formatOrderNumber } from '../orders/status';
import { createCartFromLines, describeCartAdjustments, getCartItems, priceCart, setCartQuantity, type Cart, type CartProduct } from './cart';

/** Cart state seeded from this week's draft or the previous order, with live pricing. */
export function useCart(seed: CartSeed, products: readonly CartProduct[]) {
  const initial = useMemo(() => createCartFromLines(seed.lines, products), [seed, products]);
  const [cart, setCart] = useState<Cart>(initial.cart);
  const pricing = useMemo(() => priceCart(cart, products), [cart, products]);
  const items = useMemo(() => getCartItems(cart), [cart]);

  return {
    cart,
    items,
    pricing,
    units: items.reduce((sum, item) => sum + item.quantity, 0),
    setQuantity: (productId: string, quantity: number) => setCart((current) => setCartQuantity(current, productId, quantity)),
    clear: () => setCart({}),
    seedNotice: describeSeed(seed),
    adjustmentNotice: describeCartAdjustments(initial.adjustments),
  };
}

function describeSeed(seed: CartSeed): string | null {
  if (seed.lines.length === 0) return null;
  if (seed.source === 'DRAFT') return 'הסל ששמרתם נטען. אפשר להמשיך מאיפה שהפסקתם.';
  const label = seed.orderNumber ? `הזמנה ${formatOrderNumber(seed.orderNumber)}` : 'ההזמנה הקודמת';
  return `הסל מולא לפי ${label} לנוחותכם. עדכנו כמויות לפני השליחה.`;
}
