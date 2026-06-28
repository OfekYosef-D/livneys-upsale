import { notFound } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import { resolveCatalogPricing } from '@/features/pricing/engine';
import { formatRouteDeadline } from '@/features/routes/utils';
import { prisma } from '@/lib/db';
import { mapPortalOrder } from './order-mapping';
import type { CustomerPortalData, PortalProduct } from './types';

const submittedStatuses: OrderStatus[] = [
  'SUBMITTED',
  'SPECIAL_REQUEST',
  'APPROVED',
  'PACKED',
  'DELIVERED',
  'CANCELLED',
];

export async function getCustomerPortalData(customerId: string): Promise<CustomerPortalData> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      route: true,
      priceList: {
        include: {
          items: {
            include: {
              product: true,
            },
            orderBy: {
              product: {
                name: 'asc',
              },
            },
          },
        },
      },
      recommendations: {
        where: { isActive: true },
        select: { productId: true },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  const [lastSubmittedOrder, activePromotions] = await Promise.all([
    prisma.order.findFirst({
      where: {
        customerId,
        status: {
          in: submittedStatuses,
        },
      },
      include: { lines: true },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.promotion.findMany({
      where: { isActive: true },
      include: {
        productTargets: true,
        categoryTargets: true,
        customerTargets: true,
        routeTargets: true,
        priceListTargets: true,
      },
    }),
  ]);

  const recommendationIds = new Set(customer.recommendations.map((item) => item.productId));
  const previousProductIds = new Set(lastSubmittedOrder?.lines.map((line) => line.productId).filter(Boolean) ?? []);
  const pricedCatalog = resolveCatalogPricing({
    customer: {
      id: customer.id,
      routeId: customer.routeId,
      priceListId: customer.priceListId,
    },
    route: {
      id: customer.route.id,
    },
    products: customer.priceList.items.map((item) => ({
      id: item.product.id,
      name: item.product.name,
      category: item.product.category,
      basePrice: Number(item.product.basePrice),
      isActive: item.product.isActive,
      minQty: item.product.minQty,
    })),
    priceListItems: customer.priceList.items.map((item) => ({
      productId: item.productId,
      price: Number(item.price),
    })),
    promotions: activePromotions.map((promotion) => ({
      id: promotion.id,
      title: promotion.title,
      tag: promotion.tag,
      description: promotion.description,
      effectType: promotion.effectType,
      discountValue: promotion.discountValue === null ? null : Number(promotion.discountValue),
      buyQuantity: promotion.buyQuantity,
      freeQuantity: promotion.freeQuantity,
      priority: promotion.priority,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      isActive: promotion.isActive,
      productIds: [...new Set([promotion.productId, ...promotion.productTargets.map((target) => target.productId)].filter(Boolean) as string[])],
      categories: promotion.categoryTargets.map((target) => target.category),
      customerIds: promotion.customerTargets.map((target) => target.customerId),
      routeIds: promotion.routeTargets.map((target) => target.routeId),
      priceListIds: promotion.priceListTargets.map((target) => target.priceListId),
    })),
  });
  const pricedProductsById = new Map(pricedCatalog.products.map((product) => [product.id, product]));
  const products: PortalProduct[] = customer.priceList.items
    .filter((item) => item.product.isActive)
    .map((item) => {
      const priced = pricedProductsById.get(item.productId);

      return {
        id: item.product.id,
        sku: item.product.sku,
        name: item.product.name,
        category: item.product.category,
        listPrice: priced?.listPrice ?? Number(item.price),
        price: priced?.price ?? Number(item.price),
        unit: item.product.unit,
        caseSize: item.product.caseSize,
        minQty: item.product.minQty,
        assetImage: item.product.assetImage,
        imageUrl: item.product.imageUrl,
        stockLabel: item.product.stockLabel,
        description: item.product.description,
        recommended: recommendationIds.has(item.productId),
        isRecommended: recommendationIds.has(item.productId),
        isPreviousOrder: previousProductIds.has(item.productId),
        promoLabel: priced?.promoLabel,
        promotion: priced?.promotion ?? null,
      };
    });

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      contact: customer.contact,
      phone: customer.phone,
      region: customer.region,
      address: customer.address,
      notes: customer.notes,
    },
    route: {
      id: customer.route.id,
      name: customer.route.name,
      nextDelivery: customer.route.nextDeliveryAt.toISOString(),
      deadline: formatRouteDeadline(customer.route.nextCutoffAt),
      opsContactName: customer.route.opsContactName,
      opsContactPhone: customer.route.opsContactPhone,
    },
    products,
    lastOrder: mapPortalOrder(lastSubmittedOrder, customerId),
  };
}

export async function getCustomerReviewData(customerId: string): Promise<CustomerPortalData> {
  const portalData = await getCustomerPortalData(customerId);
  const draftOrder = await prisma.order.findFirst({
    where: {
      customerId,
      status: 'DRAFT',
    },
    include: { lines: true },
    orderBy: { updatedAt: 'desc' },
  });

  return {
    ...portalData,
    lastOrder: draftOrder ? mapPortalOrder(draftOrder, customerId) : portalData.lastOrder,
  };
}

export async function getCustomerConfirmationData(customerId: string, orderId?: string): Promise<CustomerPortalData> {
  const portalData = await getCustomerPortalData(customerId);
  const order = orderId
    ? await prisma.order.findFirst({
        where: {
          id: orderId,
          customerId,
          status: {
            in: submittedStatuses,
          },
        },
        include: { lines: true },
      })
    : null;

  if (!order) {
    const latestOrder = await prisma.order.findFirst({
      where: {
        customerId,
        status: {
          in: submittedStatuses,
        },
      },
      include: { lines: true },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      ...portalData,
      lastOrder: mapPortalOrder(latestOrder, customerId),
    };
  }

  return {
    ...portalData,
    lastOrder: mapPortalOrder(order, customerId),
  };
}
