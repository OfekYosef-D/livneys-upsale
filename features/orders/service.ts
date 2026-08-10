import type { OrderSource } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { PaymentTermValue } from './payment-terms';
import { buildSubmittedOrderPayload, type OrderWriteContext } from './write';

export type OrderWriteItem = {
  productId: string;
  quantity: number;
};

export async function getOrderWriteContext(customerId: string): Promise<OrderWriteContext> {
  const [customer, promotions] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        route: true,
        priceList: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
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

  if (!customer || !customer.isActive) {
    throw new Error('לקוח לא נמצא או אינו פעיל.');
  }

  if (!customer.route.isActive) {
    throw new Error('קו החלוקה של הלקוח אינו פעיל.');
  }

  return {
    customer: {
      id: customer.id,
      routeId: customer.routeId,
      priceListId: customer.priceListId,
      isActive: customer.isActive,
    },
    route: {
      id: customer.route.id,
      isActive: customer.route.isActive,
      nextDeliveryAt: customer.route.nextDeliveryAt,
      nextCutoffAt: customer.route.nextCutoffAt,
    },
    products: customer.priceList.items
      .filter((item) => item.product.isActive)
      .map((item) => ({
        id: item.productId,
        name: item.product.name,
        category: item.product.category,
        basePrice: Number(item.product.basePrice),
        isActive: item.product.isActive,
        minQty: item.product.minQty,
        orderMultiple: item.product.orderMultiple,
      })),
    priceListItems: customer.priceList.items.map((item) => ({
      productId: item.productId,
      price: Number(item.price),
    })),
    promotions: promotions.map((promotion) => ({
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
  };
}

export async function createSubmittedOrder({
  customerId,
  items,
  source,
  paymentTerm,
  notes,
  internalNote,
  replaceDraftForDeliveryWindow = false,
  now = new Date(),
}: {
  customerId: string;
  items: OrderWriteItem[];
  source: OrderSource;
  paymentTerm: PaymentTermValue;
  notes?: string | null;
  internalNote?: string | null;
  replaceDraftForDeliveryWindow?: boolean;
  now?: Date;
}): Promise<{ orderId: string; status: string; routeId: string }> {
  const context = await getOrderWriteContext(customerId);
  const payload = buildSubmittedOrderPayload({
    context,
    items,
    source,
    paymentTerm,
    now,
    notes,
    internalNote,
  });

  const existingDraft = replaceDraftForDeliveryWindow
    ? await prisma.order.findFirst({
        where: {
          customerId,
          status: 'DRAFT',
          deliveryWindowStart: context.route.nextDeliveryAt,
        },
      })
    : null;

  const order = await prisma.order.upsert({
    where: {
      id: existingDraft?.id ?? '__new_submitted_order__',
    },
    create: {
      ...payload.order,
      lines: {
        create: payload.lines.map((line) => ({
          productId: line.productId,
          productName: line.productName,
          quantity: line.quantity,
          listUnitPrice: line.listUnitPrice,
          unitPrice: line.unitPrice,
          lineSubtotal: line.lineSubtotal,
          discountTotal: line.discountTotal,
          lineTotal: line.lineTotal,
          promotionId: line.promotionId,
          promotionSnapshot: line.promotionSnapshot ?? undefined,
        })),
      },
    },
    update: {
      routeId: payload.order.routeId,
      status: payload.order.status,
      source: payload.order.source,
      deliveryWindowStart: payload.order.deliveryWindowStart,
      deadlineAt: payload.order.deadlineAt,
      submittedAt: payload.order.submittedAt,
      notes: payload.order.notes,
      internalNote: payload.order.internalNote,
      subtotal: payload.order.subtotal,
      discountTotal: payload.order.discountTotal,
      paymentTerm: payload.order.paymentTerm,
      paymentDiscountPercent: payload.order.paymentDiscountPercent,
      paymentDiscountTotal: payload.order.paymentDiscountTotal,
      total: payload.order.total,
      lines: {
        deleteMany: {},
        create: payload.lines.map((line) => ({
          productId: line.productId,
          productName: line.productName,
          quantity: line.quantity,
          listUnitPrice: line.listUnitPrice,
          unitPrice: line.unitPrice,
          lineSubtotal: line.lineSubtotal,
          discountTotal: line.discountTotal,
          lineTotal: line.lineTotal,
          promotionId: line.promotionId,
          promotionSnapshot: line.promotionSnapshot ?? undefined,
        })),
      },
    },
  });

  return {
    orderId: order.id,
    status: payload.order.status,
    routeId: context.route.id,
  };
}
