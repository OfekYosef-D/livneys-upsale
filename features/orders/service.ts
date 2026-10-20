import type { OrderSource } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AppError, NotFoundError, StaleVersionError } from '@/lib/errors';
import { runSerializable } from '@/lib/transactions';
import type { RecordAudit } from '../audit/log';
import { buildCatalogPricingInput, customerCatalogInclude } from '../catalog/customer-catalog';
import { assertLegalDocumentsApprovedForProduction, recordOrderLegalAcceptances } from '../legal/acceptance';
import { loadActivePromotions } from '../pricing/promotions';
import { resolveRouteSchedule } from '../routes/schedule';
import {
  ActiveOrderExistsError,
  assertReplayMatches,
  cancelDraftOrder,
  findOrderByIdempotencyKey,
  findOrderForDeliveryWindow,
  persistDraftOrder,
  persistSubmittedOrder,
} from './persistence';
import type { OrderItem } from './quantity';
import { assertOrderStatusTransition, type OrderStatus } from './status';
import { assertVatQuoteCurrent, getEffectiveVatRate } from './tax-rates';
import type { PaymentTermValue } from './totals';
import { buildDraftOrder, buildSubmittedOrder, type OrderWriteContext } from './write';

export type OrderActor = { userId: string; audit: RecordAudit };

export async function getOrderWriteContext(customerId: string, at: Date = new Date()): Promise<OrderWriteContext> {
  const [customer, promotions, vatRate] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, include: customerCatalogInclude }),
    loadActivePromotions(prisma),
    getEffectiveVatRate(at),
  ]);

  if (!customer?.isActive) throw new NotFoundError('הלקוח לא נמצא או אינו פעיל.');
  if (!customer.route.isActive) throw new AppError('DELIVERY_UNAVAILABLE', 'קו החלוקה של הלקוח אינו פעיל כרגע. פנו לצוות ליבני׳ס.');

  return {
    customerId: customer.id,
    routeId: customer.routeId,
    schedule: resolveRouteSchedule(customer.route, at),
    vatRatePercent: vatRate.ratePercent,
    pricing: buildCatalogPricingInput(customer, promotions),
  };
}

export type SubmitOrderInput = {
  customerId: string;
  items: OrderItem[];
  source: OrderSource;
  idempotencyKey: string;
  paymentTerm: PaymentTermValue;
  commercialTermsAccepted?: boolean;
  notes?: string | null;
  internalNote?: string | null;
  /** The VAT rate and legal version the user saw; a mismatch means the review screen is stale. */
  expectedVatRatePercent?: number;
  expectedLegalDocumentSetVersion?: string;
  actor: OrderActor;
  now?: Date;
};

export type SubmittedOrder = { orderId: string; orderNumber: number; status: OrderStatus; replayed: boolean };

/** Idempotent: re-sending the same key returns the original order instead of creating a duplicate. */
export async function submitOrder(input: SubmitOrderInput): Promise<SubmittedOrder> {
  const now = input.now ?? new Date();
  const replay = await prisma.order.findFirst({
    where: { idempotencyKey: input.idempotencyKey, customerId: input.customerId },
    select: { id: true, orderNumber: true, status: true },
  });
  if (replay) return { orderId: replay.id, orderNumber: replay.orderNumber, status: replay.status, replayed: true };

  const context = await getOrderWriteContext(input.customerId, now);
  if (input.expectedVatRatePercent !== undefined) assertVatQuoteCurrent(input.expectedVatRatePercent, context.vatRatePercent);
  if (input.source === 'CUSTOMER') assertLegalDocumentsApprovedForProduction();

  const snapshot = buildSubmittedOrder({
    context,
    items: input.items,
    source: input.source,
    paymentTerm: input.paymentTerm,
    commercialTermsAccepted: input.commercialTermsAccepted,
    notes: input.notes,
    internalNote: input.internalNote,
    now,
  });
  const deliveryWindowStart = snapshot.order.deliveryWindowStart;

  const { order, replayed } = await runSerializable(
    async (tx) => {
      const result = await persistSubmittedOrder(tx, {
        snapshot,
        idempotencyKey: input.idempotencyKey,
        replaceDraft: input.source === 'CUSTOMER',
      });
      if (result.replayed) return result;

      if (input.source === 'CUSTOMER') {
        await recordOrderLegalAcceptances(tx, {
          orderId: result.order.id,
          customerId: input.customerId,
          userId: input.actor.userId,
          acceptedAt: now,
          expectedDocumentSetVersion: input.expectedLegalDocumentSetVersion ?? '',
        });
      }
      await input.actor.audit(tx, {
        customerId: input.customerId,
        entityType: 'Order',
        entityId: result.order.id,
        action: 'ORDER_SUBMITTED',
        after: {
          orderNumber: result.order.orderNumber,
          status: result.order.status,
          source: input.source,
          deliveryWindowStart,
          total: snapshot.order.total,
          vatRatePercent: snapshot.order.vatRatePercent,
          totalIncludingVat: snapshot.order.totalIncludingVat,
        },
      });
      return result;
    },
    {
      // A concurrent request may have committed the same submit, or another order for this window.
      onConflict: async () => {
        const committed = await findOrderByIdempotencyKey(prisma, input.idempotencyKey);
        if (committed) {
          assertReplayMatches(committed, input.customerId, deliveryWindowStart);
          return { order: committed, replayed: true };
        }
        const active = await findOrderForDeliveryWindow(prisma, input.customerId, deliveryWindowStart);
        if (active && active.status !== 'DRAFT') throw new ActiveOrderExistsError(active);
        return undefined;
      },
    },
  );

  return { orderId: order.id, orderNumber: order.orderNumber, status: order.status, replayed };
}

/** Keeps the customer's cart server-side between the catalog and the review screen. */
export async function saveDraftOrder(customerId: string, items: OrderItem[], now: Date = new Date()): Promise<{ orderId: string | null }> {
  const context = await getOrderWriteContext(customerId, now);
  const snapshot = buildDraftOrder({ context, items, now });

  if (!snapshot) {
    await runSerializable((tx) => cancelDraftOrder(tx, customerId, context.schedule.deliveryAt));
    return { orderId: null };
  }

  const order = await runSerializable((tx) => persistDraftOrder(tx, snapshot));
  return { orderId: order.id };
}

/** Admin workflow transition with optimistic locking; packing is blocked while an addition awaits review. */
export async function changeOrderStatus({
  orderId,
  status,
  audit,
}: {
  orderId: string;
  status: OrderStatus;
  audit: RecordAudit;
}): Promise<{ orderId: string; customerId: string; status: OrderStatus }> {
  return runSerializable(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        revision: true,
        customerId: true,
        additionRequests: { where: { status: 'PENDING' }, select: { id: true } },
      },
    });
    if (!order) throw new NotFoundError('ההזמנה לא נמצאה.');

    assertOrderStatusTransition(order.status, status);
    if (status === 'PACKED' && order.additionRequests.length > 0) {
      throw new AppError('ORDER_LOCKED', 'יש לאשר או לדחות את בקשת התוספת לפני אריזת ההזמנה.');
    }

    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status, revision: order.revision },
      data: { status, revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw new StaleVersionError('ההזמנה השתנתה. רעננו את המסך ונסו שוב.');

    await audit(tx, {
      customerId: order.customerId,
      entityType: 'Order',
      entityId: order.id,
      action: 'ORDER_STATUS_CHANGED',
      before: { status: order.status },
      after: { status },
    });
    return { orderId: order.id, customerId: order.customerId, status };
  });
}
