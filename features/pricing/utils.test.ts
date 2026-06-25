import { describe, expect, it } from 'vitest';
import { resolveProductPrices } from './utils';

describe('pricing utilities', () => {
  it('resolves customer price-list prices and excludes inactive products', () => {
    const prices = resolveProductPrices({
      products: [
        { id: 'prod-eggplant', name: 'ממרח חציל', basePrice: 30, isActive: true },
        { id: 'prod-hidden', name: 'לא פעיל', basePrice: 99, isActive: false },
      ],
      priceListItems: [{ productId: 'prod-eggplant', price: 28 }],
    });

    expect(prices).toEqual([
      {
        id: 'prod-eggplant',
        name: 'ממרח חציל',
        price: 28,
      },
    ]);
  });
});
