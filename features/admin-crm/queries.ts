import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { customerCatalogInclude, priceCustomerCatalog } from '../catalog/customer-catalog';
import { getEffectiveVatRate } from '../orders/tax-rates';
import { getPromotionProductIds, loadActivePromotions } from '../pricing/promotions';
import { resolveRouteSchedule } from '../routes/schedule';

/** Demo/QA accounts (@livneys.local) are hidden from operational lists. */
const realCustomers: Prisma.CustomerWhereInput = {
  OR: [{ email: null }, { NOT: { email: { endsWith: '@livneys.local', mode: 'insensitive' } } }],
};

const listPriceLists = () =>
  prisma.priceList.findMany({ select: { id: true, name: true, isDefault: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });

export async function getCustomerManagementData() {
  const [customers, routes, priceLists] = await Promise.all([
    prisma.customer.findMany({
      where: realCustomers,
      include: {
        route: { select: { name: true } },
        priceList: { select: { name: true } },
        notificationPreference: true,
        _count: { select: { orders: { where: { status: { not: 'DRAFT' } } } } },
        orders: {
          where: { status: { not: 'DRAFT' } },
          select: { status: true, submittedAt: true, totalIncludingVat: true },
          orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.route.findMany({ select: { id: true, name: true, isActive: true }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }),
    listPriceLists(),
  ]);

  return {
    customers: customers.map(({ route, priceList, notificationPreference, _count, orders, ...customer }) => ({
      ...customer,
      routeName: route.name,
      priceListName: priceList.name,
      emailEnabled: notificationPreference?.emailEnabled ?? true,
      whatsappEnabled: notificationPreference?.whatsappEnabled ?? false,
      orderCount: _count.orders,
      latestOrder: orders[0]
        ? { status: orders[0].status, submittedAt: orders[0].submittedAt?.toISOString() ?? null, totalIncludingVat: Number(orders[0].totalIncludingVat) }
        : null,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    })),
    routes,
    priceLists,
  };
}

export async function getProductManagementData() {
  const [products, priceLists] = await Promise.all([
    prisma.product.findMany({
      include: { priceListItems: { select: { priceListId: true, price: true } }, _count: { select: { orderLines: true } } },
      orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { name: 'asc' }],
    }),
    listPriceLists(),
  ]);
  const defaultListId = priceLists.find((list) => list.isDefault)?.id;

  return {
    products: products.map(({ priceListItems, _count, basePrice, createdAt, updatedAt, ...product }) => {
      const defaultPrice = priceListItems.find((item) => item.priceListId === defaultListId);
      return {
        ...product,
        basePrice: Number(basePrice),
        price: Number(defaultPrice?.price ?? basePrice),
        prices: priceListItems.map((item) => ({ priceListId: item.priceListId, price: Number(item.price) })),
        orderLineCount: _count.orderLines,
      };
    }),
    priceLists,
  };
}

export async function getPriceListManagementData() {
  const [priceLists, products] = await Promise.all([
    prisma.priceList.findMany({
      include: { items: { select: { productId: true, price: true } }, _count: { select: { customers: true } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true, category: true, basePrice: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
  ]);

  return {
    priceLists: priceLists.map((priceList) => ({
      id: priceList.id,
      name: priceList.name,
      description: priceList.description,
      isDefault: priceList.isDefault,
      customerCount: priceList._count.customers,
      items: priceList.items.map((item) => ({ productId: item.productId, price: Number(item.price) })),
    })),
    products: products.map((product) => ({ ...product, basePrice: Number(product.basePrice) })),
  };
}

export async function getRouteManagementData(now: Date = new Date()) {
  const routes = await prisma.route.findMany({
    include: { _count: { select: { customers: { where: { isActive: true } } } } },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  return {
    routes: routes.map(({ _count, nextDeliveryAt, nextCutoffAt, createdAt, updatedAt, ...route }) => {
      const schedule = resolveRouteSchedule({ ...route, nextDeliveryAt, nextCutoffAt }, now);
      return {
        ...route,
        deliveryAt: schedule.deliveryAt.toISOString(),
        cutoffAt: schedule.cutoffAt.toISOString(),
        customerCount: _count.customers,
      };
    }),
  };
}

export async function getPromotionManagementData() {
  const [promotions, products, customers, routes, priceLists] = await Promise.all([
    prisma.promotion.findMany({
      include: {
        productTargets: { include: { product: { select: { name: true } } } },
        product: { select: { name: true } },
        categoryTargets: true,
        customerTargets: true,
        routeTargets: true,
        priceListTargets: true,
      },
      orderBy: [{ isActive: 'desc' }, { priority: 'desc' }, { title: 'asc' }],
    }),
    prisma.product.findMany({ select: { id: true, name: true, sku: true, category: true, isActive: true }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }),
    prisma.customer.findMany({ where: { isActive: true, ...realCustomers }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.route.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    listPriceLists(),
  ]);

  return {
    promotions: promotions.map((promotion) => {
      const productIds = getPromotionProductIds(promotion);
      const targetCounts = [
        [productIds.length, 'מוצרים'],
        [promotion.categoryTargets.length, 'קטגוריות'],
        [promotion.customerTargets.length, 'לקוחות'],
        [promotion.routeTargets.length, 'קווים'],
        [promotion.priceListTargets.length, 'מחירונים'],
      ] as const;
      return {
        id: promotion.id,
        title: promotion.title,
        tag: promotion.tag,
        description: promotion.description,
        effectType: promotion.effectType,
        discountValue: promotion.discountValue === null ? null : Number(promotion.discountValue),
        buyQuantity: promotion.buyQuantity,
        freeQuantity: promotion.freeQuantity,
        priority: promotion.priority,
        isActive: promotion.isActive,
        startsAt: promotion.startsAt?.toISOString() ?? null,
        endsAt: promotion.endsAt?.toISOString() ?? null,
        productIds,
        productName: promotion.product?.name ?? promotion.productTargets[0]?.product.name ?? 'כל המוצרים',
        categories: promotion.categoryTargets.map((target) => target.category),
        customerIds: promotion.customerTargets.map((target) => target.customerId),
        routeIds: promotion.routeTargets.map((target) => target.routeId),
        priceListIds: promotion.priceListTargets.map((target) => target.priceListId),
        targetSummary: targetCounts.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`).join(' · ') || 'כל הלקוחות',
      };
    }),
    products,
    customers,
    routes,
    priceLists,
    categories: [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, 'he')),
  };
}

export async function getRecommendationManagementData() {
  const [recommendations, customers, products] = await Promise.all([
    prisma.customerProductRecommendation.findMany({
      include: { customer: { select: { name: true } }, product: { select: { name: true } } },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    }),
    prisma.customer.findMany({ where: { isActive: true, ...realCustomers }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, sku: true }, orderBy: { name: 'asc' } }),
  ]);

  return {
    recommendations: recommendations.map((recommendation) => ({
      id: recommendation.id,
      customerId: recommendation.customerId,
      customerName: recommendation.customer.name,
      productId: recommendation.productId,
      productName: recommendation.product.name,
      reason: recommendation.reason,
      isActive: recommendation.isActive,
      updatedAt: recommendation.updatedAt.toISOString(),
    })),
    customers,
    products,
  };
}

export async function getManualOrderData(now: Date = new Date()) {
  const [customers, promotions, vatRate] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true, route: { isActive: true }, ...realCustomers },
      include: customerCatalogInclude,
      orderBy: { name: 'asc' },
    }),
    loadActivePromotions(prisma),
    getEffectiveVatRate(now),
  ]);

  return {
    vatRatePercent: vatRate.ratePercent,
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      contact: customer.contact,
      phone: customer.phone,
      routeName: customer.route.name,
      priceListName: customer.priceList.name,
      deliveryAt: resolveRouteSchedule(customer.route, now).deliveryAt.toISOString(),
      products: priceCustomerCatalog(customer, promotions, now),
    })),
  };
}

export type CustomerManagementData = Awaited<ReturnType<typeof getCustomerManagementData>>;
export type ProductManagementData = Awaited<ReturnType<typeof getProductManagementData>>;
export type PriceListManagementData = Awaited<ReturnType<typeof getPriceListManagementData>>;
export type RouteManagementData = Awaited<ReturnType<typeof getRouteManagementData>>;
export type PromotionManagementData = Awaited<ReturnType<typeof getPromotionManagementData>>;
export type RecommendationManagementData = Awaited<ReturnType<typeof getRecommendationManagementData>>;
export type ManualOrderData = Awaited<ReturnType<typeof getManualOrderData>>;
