import { describe, expect, it } from 'vitest';
import { calculateOrderPricing, type PricingPromotion } from '../pricing/engine';
import { createCartFromLines, describeCartAdjustments, filterCatalog, priceCart, priceCartIncrement, setCartQuantity, type CartProduct } from './cart';

const bundle: PricingPromotion = {
  id: 'b', title: '12+2', tag: '12+2', description: '', effectType: 'BUY_X_GET_Y', discountValue: null, buyQuantity: 12, freeQuantity: 2,
  priority: 1, startsAt: null, endsAt: null, isActive: true, productIds: [], categories: [], customerIds: [], routeIds: [], priceListIds: [],
};

const products: CartProduct[] = [
  { id: 'jar', name: 'ממרח', sku: 'LIV-1', category: 'ממרחים', listPrice: 20, promotion: bundle, minQty: 6, orderMultiple: 6 },
  { id: 'sauce', name: 'רוטב', sku: 'LIV-2', category: 'רטבים', listPrice: 30, promotion: null, minQty: 1, orderMultiple: 1 },
];

describe('cart', () => {
  it('seeds from a previous order, dropping discontinued items and rounding to current case sizes', () => {
    const { cart, adjustments } = createCartFromLines(
      [{ productId: 'jar', quantity: 8 }, { productId: 'gone', quantity: 2 }, { productId: null, quantity: 1 }, { productId: 'sauce', quantity: 3 }],
      products,
    );
    expect(cart).toEqual({ jar: 12, sauce: 3 });
    expect(adjustments).toEqual({ removedUnavailable: 1, adjustedQuantities: 1 });
    expect(describeCartAdjustments(adjustments)).toContain('אינם זמינים');
  });

  it('prices exactly like the server engine (no client/server drift)', () => {
    const cart = { jar: 18, sauce: 2 };
    const client = priceCart(cart, products);
    const server = calculateOrderPricing({
      target: { customerId: 'c', routeId: 'r', priceListId: 'l' },
      products: products.map((product) => ({ id: product.id, name: product.name, category: product.category, basePrice: product.listPrice, isActive: true, minQty: product.minQty, orderMultiple: product.orderMultiple })),
      priceListItems: [],
      promotions: [bundle],
      items: [{ productId: 'jar', quantity: 18 }, { productId: 'sauce', quantity: 2 }],
    });
    expect(client.total).toBe(server.total);
    expect(client.discountTotal).toBe(40);
  });

  it('prices an addition incrementally so a bundle reached by the addition is honoured once', () => {
    expect(priceCartIncrement({ jar: 6 }, products, [{ productId: 'jar', quantity: 6 }])).toEqual({ subtotal: 120, discountTotal: 0, total: 120 });
    expect(priceCartIncrement({ jar: 6 }, products, [{ productId: 'jar', quantity: 12 }])).toEqual({ subtotal: 120, discountTotal: 40, total: 80 });
  });

  it('removes zero quantities and searches name, category and SKU', () => {
    expect(setCartQuantity({ jar: 6 }, 'jar', 0)).toEqual({});
    expect(filterCatalog(products, { category: 'all', query: 'liv-2' }).map((product) => product.id)).toEqual(['sauce']);
    expect(filterCatalog(products, { category: 'ממרחים', query: '' }).map((product) => product.id)).toEqual(['jar']);
  });
});
