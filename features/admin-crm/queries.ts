import { resolveCatalogPricing } from '@/features/pricing/engine';
import { prisma } from '@/lib/db';

export async function getCustomerManagementData() {
  const [customers, routes, priceLists] = await Promise.all([
    prisma.customer.findMany({
      where: {
        OR: [
          { email: null },
          { NOT: { email: { endsWith: '@livneys.local', mode: 'insensitive' } } },
        ],
      },
      include: {
        route: true,
        priceList: true,
        notificationPreference: true,
        _count: {
          select: { orders: true, recommendations: true },
        },
        orders: {
          include: { lines: true },
          orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.route.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.priceList.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    }),
  ]);

  return {
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      invoiceName: customer.invoiceName,
      contact: customer.contact,
      email: customer.email,
      phone: customer.phone,
      accountingContactName: customer.accountingContactName,
      accountingEmail: customer.accountingEmail,
      accountingPhone: customer.accountingPhone,
      businessType: customer.businessType,
      region: customer.region,
      address: customer.address,
      deliveryConstraints: customer.deliveryConstraints,
      notes: customer.notes,
      statusLabel: customer.statusLabel,
      isActive: customer.isActive,
      routeId: customer.routeId,
      routeName: customer.route.name,
      priceListId: customer.priceListId,
      priceListName: customer.priceList.name,
      emailEnabled: customer.notificationPreference?.emailEnabled ?? true,
      whatsappEnabled: customer.notificationPreference?.whatsappEnabled ?? false,
      orderCount: customer._count.orders,
      recommendationCount: customer._count.recommendations,
      latestOrder: customer.orders[0]
        ? {
            id: customer.orders[0].id,
            status: customer.orders[0].status,
            submittedAt: customer.orders[0].submittedAt?.toISOString() ?? null,
            total: Number(customer.orders[0].total),
          }
        : null,
    })),
    routes: routes.map((route) => ({
      id: route.id,
      name: route.name,
      isActive: route.isActive,
    })),
    priceLists: priceLists.map((priceList) => ({
      id: priceList.id,
      name: priceList.name,
      isDefault: priceList.isDefault,
    })),
  };
}

export async function getProductManagementData() {
  const [products, priceLists] = await Promise.all([
    prisma.product.findMany({
      include: {
        priceListItems: {
          include: {
            priceList: true,
          },
        },
        _count: {
          select: { orderLines: true, promotions: true, recommendations: true },
        },
      },
      orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { name: 'asc' }],
    }),
    prisma.priceList.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    }),
  ]);

  return {
    products: products.map((product) => {
      const defaultPrice = product.priceListItems.find((item) => item.priceList.isDefault);

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        description: product.description,
        basePrice: Number(product.basePrice),
        unit: product.unit,
        caseSize: product.caseSize,
        minQty: product.minQty,
        orderMultiple: product.orderMultiple,
        imageUrl: product.imageUrl,
        assetImage: product.assetImage,
        stockLabel: product.stockLabel,
        isActive: product.isActive,
        defaultPrice: defaultPrice ? Number(defaultPrice.price) : null,
        prices: product.priceListItems.map((item) => ({
          priceListId: item.priceListId,
          priceListName: item.priceList.name,
          isDefault: item.priceList.isDefault,
          price: Number(item.price),
        })),
        orderLineCount: product._count.orderLines,
        promotionCount: product._count.promotions,
        recommendationCount: product._count.recommendations,
      };
    }),
    priceLists: priceLists.map((priceList) => ({
      id: priceList.id,
      name: priceList.name,
      isDefault: priceList.isDefault,
    })),
  };
}

export async function getPriceListManagementData() {
  const [priceLists, products] = await Promise.all([
    prisma.priceList.findMany({
      include: {
        items: {
          include: { product: true },
          orderBy: { product: { name: 'asc' } },
        },
        _count: {
          select: { customers: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    }),
    prisma.product.findMany({
      where: { isActive: true },
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
      items: priceList.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        category: item.product.category,
        price: Number(item.price),
      })),
    })),
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      basePrice: Number(product.basePrice),
    })),
  };
}

export async function getRouteManagementData() {
  const routes = await prisma.route.findMany({
    include: {
      _count: {
        select: { customers: true, orders: true },
      },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  return {
    routes: routes.map((route) => ({
      id: route.id,
      name: route.name,
      region: route.region,
      driver: route.driver,
      opsContactName: route.opsContactName,
      opsContactPhone: route.opsContactPhone,
      deliveryWeekday: route.deliveryWeekday,
      cutoffWeekday: route.cutoffWeekday,
      cutoffTime: route.cutoffTime,
      nextDeliveryAt: route.nextDeliveryAt.toISOString(),
      nextCutoffAt: route.nextCutoffAt.toISOString(),
      isActive: route.isActive,
      customerCount: route._count.customers,
      orderCount: route._count.orders,
    })),
  };
}

export async function getPromotionManagementData() {
  const [promotions, products, customers, routes, priceLists] = await Promise.all([
    prisma.promotion.findMany({
      include: {
        product: true,
        productTargets: { include: { product: true } },
        categoryTargets: true,
        customerTargets: { include: { customer: true } },
        routeTargets: { include: { route: true } },
        priceListTargets: { include: { priceList: true } },
      },
      orderBy: [{ isActive: 'desc' }, { title: 'asc' }],
    }),
    prisma.product.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.route.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.priceList.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    }),
  ]);

  return {
    promotions: promotions.map((promotion) => ({
      id: promotion.id,
      title: promotion.title,
      tag: promotion.tag,
      description: promotion.description,
      productId: promotion.productId,
      productName: promotion.product?.name ?? promotion.productTargets[0]?.product.name ?? 'כל המוצרים',
      effectType: promotion.effectType,
      discountValue: promotion.discountValue === null ? null : Number(promotion.discountValue),
      buyQuantity: promotion.buyQuantity,
      freeQuantity: promotion.freeQuantity,
      priority: promotion.priority,
      productIds: [...new Set([promotion.productId, ...promotion.productTargets.map((target) => target.productId)].filter(Boolean) as string[])],
      categories: promotion.categoryTargets.map((target) => target.category),
      customerIds: promotion.customerTargets.map((target) => target.customerId),
      routeIds: promotion.routeTargets.map((target) => target.routeId),
      priceListIds: promotion.priceListTargets.map((target) => target.priceListId),
      targetSummary: summarizePromotionTargets({
        products: promotion.productTargets.map((target) => target.product.name),
        categories: promotion.categoryTargets.map((target) => target.category),
        customers: promotion.customerTargets.map((target) => target.customer.name),
        routes: promotion.routeTargets.map((target) => target.route.name),
        priceLists: promotion.priceListTargets.map((target) => target.priceList.name),
      }),
      startsAt: promotion.startsAt?.toISOString() ?? null,
      endsAt: promotion.endsAt?.toISOString() ?? null,
      isActive: promotion.isActive,
    })),
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      isActive: product.isActive,
    })),
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
    })),
    routes: routes.map((route) => ({
      id: route.id,
      name: route.name,
    })),
    priceLists: priceLists.map((priceList) => ({
      id: priceList.id,
      name: priceList.name,
      isDefault: priceList.isDefault,
    })),
    categories: [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, 'he')),
  };
}

export async function getRecommendationManagementData() {
  const [recommendations, customers, products] = await Promise.all([
    prisma.customerProductRecommendation.findMany({
      include: {
        customer: true,
        product: true,
      },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    }),
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
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
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
    })),
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
    })),
  };
}

export async function getManualOrderData() {
  const [customers, activePromotions] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      include: {
        route: true,
        priceList: {
          include: {
            items: {
              include: { product: true },
              orderBy: {
                product: {
                  name: 'asc',
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
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
  const promotions = activePromotions.map((promotion) => ({
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
  }));

  return {
    customers: customers
      .filter((customer) => customer.route.isActive)
      .map((customer) => {
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
          promotions,
        });
        const pricedProductsById = new Map(pricedCatalog.products.map((product) => [product.id, product]));

        return {
          id: customer.id,
          name: customer.name,
          contact: customer.contact,
          phone: customer.phone,
          routeId: customer.routeId,
          routeName: customer.route.name,
          priceListName: customer.priceList.name,
          nextDeliveryAt: customer.route.nextDeliveryAt.toISOString(),
          nextCutoffAt: customer.route.nextCutoffAt.toISOString(),
          products: customer.priceList.items
            .filter((item) => item.product.isActive)
            .map((item) => {
              const priced = pricedProductsById.get(item.productId);

              return {
                id: item.productId,
                sku: item.product.sku,
                name: item.product.name,
                category: item.product.category,
                listPrice: priced?.listPrice ?? Number(item.price),
                price: priced?.price ?? Number(item.price),
            minQty: item.product.minQty,
            orderMultiple: item.product.orderMultiple,
            unit: item.product.unit,
                caseSize: item.product.caseSize,
                imageUrl: item.product.imageUrl,
                assetImage: item.product.assetImage,
                promoLabel: priced?.promoLabel,
                promotion: priced?.promotion ?? null,
              };
            }),
        };
      }),
  };
}

function summarizePromotionTargets({
  products,
  categories,
  customers,
  routes,
  priceLists,
}: {
  products: string[];
  categories: string[];
  customers: string[];
  routes: string[];
  priceLists: string[];
}): string {
  const parts = [
    products.length > 0 ? `${products.length} מוצרים` : null,
    categories.length > 0 ? `${categories.length} קטגוריות` : null,
    customers.length > 0 ? `${customers.length} לקוחות` : null,
    routes.length > 0 ? `${routes.length} קווים` : null,
    priceLists.length > 0 ? `${priceLists.length} מחירונים` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'כל הלקוחות והמחירונים';
}
