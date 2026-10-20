import type { Prisma } from '@prisma/client';
import {
  resolveCatalogPricing,
  type AppliedPromotion,
  type PricingProduct,
  type PricingPromotion,
  type PricingTarget,
} from '../pricing/engine';

/** Everything needed to price a customer's catalog in one query. */
export const customerCatalogInclude = {
  route: true,
  priceList: {
    include: {
      items: {
        include: { product: true },
        orderBy: [{ product: { category: 'asc' } }, { product: { name: 'asc' } }],
      },
    },
  },
} satisfies Prisma.CustomerInclude;

export type CustomerWithCatalog = Prisma.CustomerGetPayload<{ include: typeof customerCatalogInclude }>;

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  unit: string;
  caseSize: string;
  minQty: number;
  orderMultiple: number;
  imageUrl: string | null;
  assetImage: string | null;
  stockLabel: string | null;
  listPrice: number;
  price: number;
  promoLabel?: string;
  promotion: AppliedPromotion | null;
};

export type CatalogPricingInput = {
  target: PricingTarget;
  products: PricingProduct[];
  priceListItems: Array<{ productId: string; price: number }>;
  promotions: PricingPromotion[];
};

/** Only active products on the customer's price list can be ordered. */
export function buildCatalogPricingInput(customer: CustomerWithCatalog, promotions: PricingPromotion[]): CatalogPricingInput {
  const activeItems = customer.priceList.items.filter((item) => item.product.isActive);
  return {
    target: { customerId: customer.id, routeId: customer.routeId, priceListId: customer.priceListId },
    products: activeItems.map(({ product }) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      basePrice: Number(product.basePrice),
      isActive: product.isActive,
      minQty: product.minQty,
      orderMultiple: product.orderMultiple,
    })),
    priceListItems: activeItems.map((item) => ({ productId: item.productId, price: Number(item.price) })),
    promotions,
  };
}

export function priceCustomerCatalog(
  customer: CustomerWithCatalog,
  promotions: PricingPromotion[],
  now: Date = new Date(),
): CatalogProduct[] {
  const prices = new Map(
    resolveCatalogPricing({ ...buildCatalogPricingInput(customer, promotions), now }).map((price) => [price.productId, price]),
  );

  return customer.priceList.items.flatMap(({ product }) => {
    const price = prices.get(product.id);
    if (!price) return [];
    return [{
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      description: product.description,
      unit: product.unit,
      caseSize: product.caseSize,
      minQty: product.minQty,
      orderMultiple: product.orderMultiple,
      imageUrl: product.imageUrl,
      assetImage: product.assetImage,
      stockLabel: product.stockLabel,
      listPrice: price.listPrice,
      price: price.price,
      promoLabel: price.promoLabel,
      promotion: price.promotion,
    }];
  });
}
