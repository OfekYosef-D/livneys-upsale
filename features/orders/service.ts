import { Prisma, type OrderSource } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { appendAuditLog } from '../audit/log';
import { assertLegalDocumentsApprovedForProduction, recordOrderLegalAcceptances } from '../legal/acceptance';
import { SafeActionError } from '../../lib/safe-action-error';
import type { PaymentTermValue } from './payment-terms';
import {
  ActiveOrderExistsError,
  IdempotencyKeyConflictError,
  isRetryableOrderWriteError,
  persistSubmittedOrder,
  StaleOrderWriteError,
} from './persistence';
import { buildSubmittedOrderPayload, type OrderWriteContext } from './write';
import { assertVatQuoteCurrent, getEffectiveVatRate } from './tax-rates';

export type OrderWriteItem = {
  productId: string;
  quantity: number;
};

export async function getOrderWriteContext(customerId: string, at = new Date()): Promise<OrderWriteContext> {
  const [customer, promotions, vatRate] = await Promise.all([
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
    getEffectiveVatRate(at),
  ]);

  if (!customer || !customer.isActive) {
    throw new SafeActionError('NOT_FOUND', 'הלקוח לא נמצא או אינו פעיל.');
  }

  if (!customer.route.isActive) {
    throw new SafeActionError('ORDER_LOCKED', 'קו החלוקה של הלקוח אינו פעיל.');
  }

  return {
    vatRatePercent: vatRate.ratePercent,
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
  idempotencyKey,
  paymentTerm,
  commercialTermsAccepted = false,
  notes,
  internalNote,
  replaceDraftForDeliveryWindow = false,
  actorUserId,
  expectedVatRatePercent,
  now = new Date(),
}: {
  customerId: string;
  items: OrderWriteItem[];
  source: OrderSource;
  idempotencyKey: string;
  paymentTerm: PaymentTermValue;
  commercialTermsAccepted?: boolean;
  notes?: string | null;
  internalNote?: string | null;
  replaceDraftForDeliveryWindow?: boolean;
  actorUserId?: string | null;
  expectedVatRatePercent?: number;
  now?: Date;
}): Promise<{ orderId: string; orderNumber: number; status: string; routeId: string; replayed: boolean }> {
  const existingReplay = await prisma.order.findFirst({
    where: {
      idempotencyKey,
      customerId,
      customer: { isActive: true },
    },
    select: { id: true, orderNumber: true, status: true, routeId: true },
  });

  if (existingReplay?.routeId) {
    return {
      orderId: existingReplay.id,
      orderNumber: existingReplay.orderNumber,
      status: existingReplay.status,
      routeId: existingReplay.routeId,
      replayed: true,
    };
  }

  const context = await getOrderWriteContext(customerId, now);
  if (expectedVatRatePercent !== undefined) {
    assertVatQuoteCurrent(expectedVatRatePercent, context.vatRatePercent ?? 0);
  }
  if (source === 'CUSTOMER') {
    assertLegalDocumentsApprovedForProduction();
    if (!actorUserId) throw new SafeActionError('UNAUTHORIZED', 'לא ניתן לתעד את מאשר ההזמנה. התחברו מחדש ונסו שוב.');
  }
  const payload = buildSubmittedOrderPayload({
    context,
    items,
    source,
    paymentTerm,
    commercialTermsAccepted,
    now,
    notes,
    internalNote,
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const persisted = await prisma.$transaction(
        async (tx) => {
          const result = await persistSubmittedOrder(tx, {
            payload,
            idempotencyKey,
            replaceDraftForDeliveryWindow,
          });
          if (result.replayed) return result;

          const requestId = randomUUID();
          if (source === 'CUSTOMER' && actorUserId) {
            await recordOrderLegalAcceptances(tx, {
              orderId: result.order.id,
              customerId,
              userId: actorUserId,
              acceptedAt: now,
            });
          }
          await appendAuditLog(tx, {
            actorUserId,
            actorRole: source === 'CUSTOMER' ? 'CUSTOMER' : 'ADMIN',
            customerId,
            entityType: 'Order',
            entityId: result.order.id,
            action: 'ORDER_SUBMITTED',
            requestId,
            after: {
              orderNumber: result.order.orderNumber,
              status: result.order.status,
              source,
              deliveryWindowStart: result.order.deliveryWindowStart,
              total: payload.order.total,
              vatRatePercent: payload.order.vatRatePercent,
              totalIncludingVat: payload.order.totalIncludingVat,
            },
          });
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return {
        orderId: persisted.order.id,
        orderNumber: persisted.order.orderNumber,
        status: persisted.order.status,
        routeId: context.route.id,
        replayed: persisted.replayed,
      };
    } catch (error) {
      const isConcurrentWrite = error instanceof StaleOrderWriteError || isRetryableOrderWriteError(error);
      if (!isConcurrentWrite) throw error;

      const replayedOrder = await prisma.order.findUnique({
        where: { idempotencyKey },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          routeId: true,
          customerId: true,
          deliveryWindowStart: true,
        },
      });

      if (replayedOrder) {
        if (
          replayedOrder.customerId !== customerId
          || replayedOrder.deliveryWindowStart.getTime() !== context.route.nextDeliveryAt.getTime()
        ) {
          throw new IdempotencyKeyConflictError();
        }

        return {
          orderId: replayedOrder.id,
          orderNumber: replayedOrder.orderNumber,
          status: replayedOrder.status,
          routeId: replayedOrder.routeId ?? context.route.id,
          replayed: true,
        };
      }

      const activeOrder = await prisma.order.findFirst({
        where: {
          customerId,
          deliveryWindowStart: context.route.nextDeliveryAt,
          status: { not: 'CANCELLED' },
        },
        select: { id: true, orderNumber: true, status: true },
      });

      if (activeOrder && activeOrder.status !== 'DRAFT') {
        throw new ActiveOrderExistsError(activeOrder.id, activeOrder.orderNumber, activeOrder.status);
      }

      if (attempt === 3) throw error;
    }
  }

  throw new Error('Order submission retry loop exited unexpectedly.');
}
