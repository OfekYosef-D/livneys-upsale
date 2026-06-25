import { notFound } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import { formatRouteDeadline } from '@/features/routes/utils';
import { prisma } from '@/lib/db';
import type { CustomerPortalData, PortalOrder, PortalProduct } from './types';

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
      include: { product: true },
    }),
  ]);

  const recommendationIds = new Set(customer.recommendations.map((item) => item.productId));
  const previousProductIds = new Set(lastSubmittedOrder?.lines.map((line) => line.productId).filter(Boolean) ?? []);
  const promotionsByProductId = new Map(activePromotions.map((promotion) => [promotion.productId, promotion]));
  const products: PortalProduct[] = customer.priceList.items
    .filter((item) => item.product.isActive)
    .map((item) => {
      const promotion = promotionsByProductId.get(item.productId);

      return {
        id: item.product.id,
        sku: item.product.sku,
        name: item.product.name,
        category: item.product.category,
        price: Number(item.price),
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
        promoLabel: promotion?.tag,
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

function mapPortalOrder(
  order: { id: string; customerId: string; submittedAt: Date | null; createdAt: Date; status: OrderStatus; lines: { productId: string | null; quantity: number }[] } | null,
  customerId: string,
): PortalOrder {
  if (!order) {
    return {
      id: 'empty',
      customerId,
      date: new Date().toISOString(),
      status: 'DRAFT',
      items: [],
    };
  }

  return {
    id: order.id,
    customerId: order.customerId,
    date: (order.submittedAt ?? order.createdAt).toISOString(),
    status: order.status,
    items: order.lines
      .filter((line) => line.productId)
      .map((line) => ({
        productId: line.productId ?? '',
        qty: line.quantity,
      })),
  };
}
