export type PriceableProduct = {
  id: string;
  name: string;
  basePrice: number;
  isActive: boolean;
};

export type PriceListProductPrice = {
  productId: string;
  price: number;
};

export function resolveProductPrices({
  products,
  priceListItems,
}: {
  products: PriceableProduct[];
  priceListItems: PriceListProductPrice[];
}): { id: string; name: string; price: number }[] {
  const pricesByProductId = new Map(priceListItems.map((item) => [item.productId, item.price]));

  return products
    .filter((product) => product.isActive)
    .map((product) => ({
      id: product.id,
      name: product.name,
      price: pricesByProductId.get(product.id) ?? product.basePrice,
    }));
}
