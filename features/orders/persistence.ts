import type { Prisma } from '@prisma/client';
import { AppError, StaleVersionError } from '@/lib/errors';
import type { TransactionClient } from '@/lib/transactions';
import type { PricedLine } from '../pricing/engine';
import type { OrderSnapshot } from './write';

type OrderDb = Pick<TransactionClient, 'order' | 'orderLine'>;

const persistedOrderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  routeId: true,
  customerId: true,
  deliveryWindowStart: true,
  revision: true,
} as const satisfies Prisma.OrderSelect;

export type PersistedOrder = Prisma.OrderGetPayload<{ select: typeof persistedOrderSelect }>;

/** A customer has exactly one non-cancelled order per weekly delivery window. */
export class ActiveOrderExistsError extends AppError {
  constructor(order: Pick<PersistedOrder, 'id' | 'orderNumber' | 'status'>) {
    super('ACTIVE_ORDER_EXISTS', 'כבר קיימת הזמנה למועד החלוקה הזה.', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
    });
  }
}

export class IdempotencyKeyConflictError extends AppError {
  constructor() {
    super('IDEMPOTENCY_KEY_CONFLICT', 'לא ניתן להשלים את שליחת ההזמנה. רעננו את המסך ונסו שוב.');
  }
}

/** Maps a priced line onto the columns shared by OrderLine and OrderAdditionLine. */
export function toLineData(line: PricedLine) {
  return {
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
  };
}

export function findOrderForDeliveryWindow(tx: OrderDb, customerId: string, deliveryWindowStart: Date) {
  return tx.order.findFirst({
    where: { customerId, deliveryWindowStart, status: { not: 'CANCELLED' } },
    select: persistedOrderSelect,
  });
}

export function findOrderByIdempotencyKey(tx: Pick<TransactionClient, 'order'>, idempotencyKey: string) {
  return tx.order.findUnique({ where: { idempotencyKey }, select: persistedOrderSelect });
}

/** A replayed submit must refer to the same customer and delivery window, otherwise the key was reused. */
export function assertReplayMatches(order: PersistedOrder, customerId: string, deliveryWindowStart: Date): void {
  if (order.customerId !== customerId || order.deliveryWindowStart.getTime() !== deliveryWindowStart.getTime()) {
    throw new IdempotencyKeyConflictError();
  }
}

/**
 * Persists a submitted order. Replays of the same idempotency key return the original order;
 * a customer's own draft for the same window is converted in place (optimistic locking on `revision`).
 */
export async function persistSubmittedOrder(
  tx: OrderDb,
  { snapshot, idempotencyKey, replaceDraft }: { snapshot: OrderSnapshot; idempotencyKey: string; replaceDraft: boolean },
): Promise<{ order: PersistedOrder; replayed: boolean }> {
  const replayed = await findOrderByIdempotencyKey(tx, idempotencyKey);
  if (replayed) {
    assertReplayMatches(replayed, snapshot.order.customerId, snapshot.order.deliveryWindowStart);
    return { order: replayed, replayed: true };
  }

  const existing = await findOrderForDeliveryWindow(tx, snapshot.order.customerId, snapshot.order.deliveryWindowStart);
  if (existing && (!replaceDraft || existing.status !== 'DRAFT')) throw new ActiveOrderExistsError(existing);

  const order = existing
    ? await overwriteDraft(tx, existing, snapshot, idempotencyKey)
    : await createOrder(tx, snapshot, idempotencyKey);
  return { order, replayed: false };
}

/** Saves (or replaces) the customer's draft cart for the current delivery window. */
export async function persistDraftOrder(tx: OrderDb, snapshot: OrderSnapshot): Promise<PersistedOrder> {
  const existing = await findOrderForDeliveryWindow(tx, snapshot.order.customerId, snapshot.order.deliveryWindowStart);
  if (existing && existing.status !== 'DRAFT') throw new ActiveOrderExistsError(existing);
  return existing ? overwriteDraft(tx, existing, snapshot, null) : createOrder(tx, snapshot, null);
}

export async function cancelDraftOrder(tx: OrderDb, customerId: string, deliveryWindowStart: Date): Promise<boolean> {
  const draft = await tx.order.findFirst({
    where: { customerId, deliveryWindowStart, status: 'DRAFT' },
    select: persistedOrderSelect,
  });
  if (!draft) return false;

  const update = await tx.order.updateMany({
    where: { id: draft.id, status: 'DRAFT', revision: draft.revision },
    data: { status: 'CANCELLED', revision: { increment: 1 } },
  });
  return update.count === 1;
}

function createOrder(tx: OrderDb, snapshot: OrderSnapshot, idempotencyKey: string | null) {
  return tx.order.create({
    data: { ...snapshot.order, idempotencyKey, lines: { create: snapshot.lines.map(toLineData) } },
    select: persistedOrderSelect,
  });
}

async function overwriteDraft(tx: OrderDb, draft: PersistedOrder, snapshot: OrderSnapshot, idempotencyKey: string | null) {
  const update = await tx.order.updateMany({
    where: { id: draft.id, status: 'DRAFT', revision: draft.revision },
    data: { ...snapshot.order, idempotencyKey, revision: { increment: 1 } },
  });
  if (update.count !== 1) throw new StaleVersionError('ההזמנה השתנתה בזמן השליחה. רעננו את המסך ונסו שוב.');

  await tx.orderLine.deleteMany({ where: { orderId: draft.id } });
  await tx.orderLine.createMany({ data: snapshot.lines.map((line) => ({ ...toLineData(line), orderId: draft.id })) });
  return tx.order.findUniqueOrThrow({ where: { id: draft.id }, select: persistedOrderSelect });
}
