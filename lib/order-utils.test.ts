import { describe, expect, it } from 'vitest';
import {
  buildCartFromOrder,
  filterCatalogProducts,
  getCartItems,
  getCartPricingSummary,
  getCartTotal,
  setCartQuantity,
} from './order-utils';

const products = [
  {
    id: 'jam',
    name: 'ריבת תאנים',
    category: 'ריבות',
    price: 34,
    unit: 'צנצנת',
    sku: 'JAM-001',
    recommended: false,
    isPreviousOrder: true,
  },
  {
    id: 'sauce',
    name: 'רוטב עשבי תיבול',
    category: 'רטבים',
    price: 31,
    unit: 'בקבוק',
    sku: 'SAUCE-001',
    recommended: true,
    promoLabel: 'מבצע שבועי',
  },
  {
    id: 'gift',
    name: 'מארז טעימות',
    category: 'מארזים',
    price: 118,
    unit: 'מארז',
    sku: 'KIT-001',
    recommended: true,
  },
];

describe('order utilities', () => {
  it('seeds cart quantities from the last order and removes zero quantities', () => {
    const cart = buildCartFromOrder([
      { productId: 'jam', qty: 12 },
      { productId: 'sauce', qty: 6 },
    ]);

    expect(getCartItems(cart)).toEqual([
      { productId: 'jam', qty: 12 },
      { productId: 'sauce', qty: 6 },
    ]);

    expect(getCartItems(setCartQuantity(cart, 'sauce', 0))).toEqual([
      { productId: 'jam', qty: 12 },
    ]);
  });

  it('normalizes invalid quantities and calculates totals from products', () => {
    const cart = setCartQuantity({}, 'gift', -4);
    const updated = setCartQuantity(cart, 'gift', 3);

    expect(getCartItems(cart)).toEqual([]);
    expect(getCartTotal(updated, products)).toBe(354);
  });

  it('calculates cart subtotal, discount total, and final total from promotion metadata', () => {
    const cart = {
      percent: 4,
      bundle: 14,
    };

    const pricedProducts = [
      {
        id: 'percent',
        name: 'Percent',
        category: 'A',
        listPrice: 100,
        price: 90,
        promotion: {
          id: 'promo-percent',
          title: 'Percent',
          tag: '10%',
          description: '10% off',
          effectType: 'PERCENT_OFF' as const,
          discountValue: 10,
          buyQuantity: null,
          freeQuantity: null,
        },
      },
      {
        id: 'bundle',
        name: 'Bundle',
        category: 'A',
        listPrice: 30,
        price: 30,
        promotion: {
          id: 'promo-bundle',
          title: 'Bundle',
          tag: '12+2',
          description: 'Buy 12 get 2',
          effectType: 'BUY_X_GET_Y' as const,
          discountValue: null,
          buyQuantity: 12,
          freeQuantity: 2,
        },
      },
    ];

    expect(getCartPricingSummary(cart, pricedProducts)).toEqual({
      subtotal: 820,
      discountTotal: 100,
      total: 720,
    });
  });

  it('filters products by category, search text, previous order, recommended, and promotions', () => {
    expect(filterCatalogProducts(products, { category: 'ריבות', query: 'תאנים' }).map((p) => p.id)).toEqual(['jam']);
    expect(filterCatalogProducts(products, { segment: 'previous' }).map((p) => p.id)).toEqual(['jam']);
    expect(filterCatalogProducts(products, { segment: 'recommended' }).map((p) => p.id)).toEqual(['sauce', 'gift']);
    expect(filterCatalogProducts(products, { segment: 'promotions' }).map((p) => p.id)).toEqual(['sauce']);
  });
});
