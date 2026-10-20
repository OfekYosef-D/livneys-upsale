import type { OrderStatus, PaymentTerm } from '@prisma/client';
import { AppError, NotFoundError, StaleVersionError } from '@/lib/errors';
import type { TransactionClient } from '@/lib/transactions';
import type { RecordAudit } from '../audit/log';
import { toLineData } from '../orders/persistence';
import { additionAllowedStatuses, canAddItems } from '../orders/status';
import type { OrderAdditionSnapshot } from './pricing';

type AdditionDb = Pick<TransactionClient, 'orderAdditionRequest' | 'orderAdditionLine' | 'order' | 'orderLine' | 'orderActivity' | 'auditLog'>;

const STALE_MESSAGE = 'בקשת התוספת השתנתה. רעננו את המסך ונסו שוב.';

export function assertAdditionAllowed(status: OrderStatus): void {
  if (!canAddItems(status)) throw new AppError('ORDER_LOCKED', 'לא ניתן להוסיף פריטים להזמנה בשלב זה.');
}

/**
 * Creates the order's open addition request, or replaces the lines of the one that is still
 * pending (a customer has at most one open request per order). Idempotent per mutation key.
 */
export async function persistPendingAdditionRequest(
  tx: AdditionDb,
  input: {
    orderId: string;
    customerId: string;
    paymentTerm: PaymentTerm;
    idempotencyKey: string;
    snapshot: OrderAdditionSnapshot;
    now: Date;
    actorUserId: string;
    audit: RecordAudit;
  },
) {
  const replayed = await tx.orderAdditionRequest.findFirst({
    where: { OR: [{ idempotencyKey: input.idempotencyKey }, { lastMutationKey: input.idempotencyKey }] },
  });
  if (replayed) {
    if (replayed.orderId !== input.orderId || replayed.customerId !== input.customerId) {
      throw new AppError('IDEMPOTENCY_KEY_CONFLICT', 'לא ניתן להשלים את בקשת התוספת. רעננו ונסו שוב.');
    }
    return { request: replayed, replayed: true };
  }

  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    select: { customerId: true, status: true, revision: true },
  });
  if (!order || order.customerId !== input.customerId) throw new NotFoundError('ההזמנה לא נמצאה.');
  assertAdditionAllowed(order.status);

  const { lines, ...totals } = input.snapshot;
  const requestData = {
    ...totals,
    paymentTerm: input.paymentTerm,
    orderRevisionAtSubmission: order.revision,
    submittedAt: input.now,
    status: 'PENDING' as const,
    rejectionReason: null,
    reviewedAt: null,
    reviewedByUserId: null,
  };

  const open = await tx.orderAdditionRequest.findFirst({
    where: { orderId: input.orderId, status: { in: ['DRAFT', 'PENDING'] } },
  });

  let requestId: string;
  if (open) {
    const updated = await tx.orderAdditionRequest.updateMany({
      where: { id: open.id, revision: open.revision, status: { in: ['DRAFT', 'PENDING'] } },
      data: { ...requestData, lastMutationKey: input.idempotencyKey, revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw new StaleVersionError(STALE_MESSAGE);
    await tx.orderAdditionLine.deleteMany({ where: { requestId: open.id } });
    await tx.orderAdditionLine.createMany({ data: lines.map((line) => ({ ...toLineData(line), requestId: open.id })) });
    requestId = open.id;
  } else {
    const created = await tx.orderAdditionRequest.create({
      data: {
        ...requestData,
        orderId: input.orderId,
        customerId: input.customerId,
        idempotencyKey: input.idempotencyKey,
        lastMutationKey: input.idempotencyKey,
        lines: { create: lines.map(toLineData) },
      },
    });
    requestId = created.id;
  }

  const change = { edited: Boolean(open), totalIncludingVat: totals.totalIncludingVat };
  await tx.orderActivity.create({
    data: { orderId: input.orderId, additionRequestId: requestId, actorUserId: input.actorUserId, action: 'ADDITION_SUBMITTED', metadata: change },
  });
  await input.audit(tx, {
    customerId: input.customerId,
    entityType: 'OrderAdditionRequest',
    entityId: requestId,
    action: 'ORDER_ADDITION_SUBMITTED',
    after: change,
  });

  return { request: await tx.orderAdditionRequest.findUniqueOrThrow({ where: { id: requestId } }), replayed: false };
}

type ReviewResult = { orderId: string; customerId: string; replayed: boolean };

/** Approving merges the request's lines and totals into the order. Replays of an approval are no-ops. */
export async function approveAdditionRequest(
  tx: AdditionDb,
  input: { requestId: string; reviewerUserId: string; now: Date; audit: RecordAudit },
): Promise<ReviewResult> {
  const request = await tx.orderAdditionRequest.findUnique({
    where: { id: input.requestId },
    include: { order: true, lines: true },
  });
  if (!request) throw new NotFoundError('בקשת התוספת לא נמצאה.');
  if (request.status === 'APPROVED') return { orderId: request.orderId, customerId: request.customerId, replayed: true };
  assertPending(request.status);
  assertAdditionAllowed(request.order.status);

  const orderUpdate = await tx.order.updateMany({
    where: { id: request.orderId, revision: request.order.revision, status: { in: additionAllowedStatuses } },
    data: {
      subtotal: { increment: request.subtotal },
      discountTotal: { increment: request.discountTotal },
      paymentDiscountTotal: { increment: request.paymentDiscountTotal },
      total: { increment: request.total },
      vatTotal: { increment: request.vatTotal },
      totalIncludingVat: { increment: request.totalIncludingVat },
      revision: { increment: 1 },
    },
  });
  if (orderUpdate.count !== 1) throw new StaleVersionError(STALE_MESSAGE);

  await tx.orderLine.createMany({
    data: request.lines.map((line) => ({
      orderId: request.orderId,
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
      additionRequestLineId: line.id,
    })),
    skipDuplicates: true,
  });

  await markReviewed(tx, request, { status: 'APPROVED', reviewerUserId: input.reviewerUserId, now: input.now });
  await recordReview(tx, input, request, 'APPROVED', { totalIncludingVat: Number(request.totalIncludingVat) });
  return { orderId: request.orderId, customerId: request.customerId, replayed: false };
}

export async function rejectAdditionRequest(
  tx: AdditionDb,
  input: { requestId: string; reviewerUserId: string; reason: string; now: Date; audit: RecordAudit },
): Promise<ReviewResult> {
  const request = await tx.orderAdditionRequest.findUnique({ where: { id: input.requestId } });
  if (!request) throw new NotFoundError('בקשת התוספת לא נמצאה.');
  if (request.status === 'REJECTED') return { orderId: request.orderId, customerId: request.customerId, replayed: true };
  assertPending(request.status);

  await markReviewed(tx, request, { status: 'REJECTED', reviewerUserId: input.reviewerUserId, now: input.now, reason: input.reason });
  await recordReview(tx, input, request, 'REJECTED', { reason: input.reason });
  return { orderId: request.orderId, customerId: request.customerId, replayed: false };
}

function assertPending(status: string) {
  if (status !== 'PENDING') throw new AppError('ORDER_LOCKED', 'בקשת התוספת כבר טופלה ואינה ממתינה לאישור.');
}

async function markReviewed(
  tx: AdditionDb,
  request: { id: string; revision: number },
  { status, reviewerUserId, now, reason }: { status: 'APPROVED' | 'REJECTED'; reviewerUserId: string; now: Date; reason?: string },
) {
  const updated = await tx.orderAdditionRequest.updateMany({
    where: { id: request.id, revision: request.revision, status: 'PENDING' },
    data: {
      status,
      reviewedAt: now,
      reviewedByUserId: reviewerUserId,
      ...(reason ? { rejectionReason: reason } : {}),
      revision: { increment: 1 },
    },
  });
  if (updated.count !== 1) throw new StaleVersionError(STALE_MESSAGE);
}

async function recordReview(
  tx: AdditionDb,
  input: { reviewerUserId: string; audit: RecordAudit },
  request: { id: string; orderId: string; customerId: string },
  decision: 'APPROVED' | 'REJECTED',
  details: Record<string, unknown>,
) {
  await tx.orderActivity.create({
    data: {
      orderId: request.orderId,
      additionRequestId: request.id,
      actorUserId: input.reviewerUserId,
      action: decision === 'APPROVED' ? 'ADDITION_APPROVED' : 'ADDITION_REJECTED',
      metadata: details as object,
    },
  });
  await input.audit(tx, {
    customerId: request.customerId,
    entityType: 'OrderAdditionRequest',
    entityId: request.id,
    action: decision === 'APPROVED' ? 'ORDER_ADDITION_APPROVED' : 'ORDER_ADDITION_REJECTED',
    before: { status: 'PENDING' },
    after: { status: decision, ...details },
  });
}
