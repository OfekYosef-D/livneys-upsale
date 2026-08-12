import { randomUUID } from 'node:crypto';
import type { PaymentTerm, Prisma } from '@prisma/client';
import { SafeActionError } from '../../lib/safe-action-error';
import { appendAuditLog } from '../audit/log';
import { assertAdditionAllowed } from './business-rules';
import type { OrderAdditionSnapshot } from './pricing';

type AdditionPersistenceClient = Pick<
  Prisma.TransactionClient,
  'orderAdditionRequest' | 'orderAdditionLine' | 'order' | 'orderLine' | 'orderActivity' | 'auditLog'
>;

export class StaleAdditionRequestError extends SafeActionError {
  constructor() {
    super('STALE_VERSION', 'בקשת התוספת השתנתה. רעננו את המסך ונסו שוב.');
    this.name = 'StaleAdditionRequestError';
  }
}

export async function persistPendingAdditionRequest(
  tx: AdditionPersistenceClient,
  input: {
    orderId: string;
    customerId: string;
    orderRevision: number;
    paymentTerm: PaymentTerm;
    idempotencyKey: string;
    snapshot: OrderAdditionSnapshot;
    now: Date;
    actorUserId?: string | null;
  },
) {
  const replayedByCreation = await tx.orderAdditionRequest.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  const replayed = replayedByCreation ?? await tx.orderAdditionRequest.findUnique({
    where: { lastMutationKey: input.idempotencyKey },
  });

  if (replayed) {
    if (replayed.orderId !== input.orderId || replayed.customerId !== input.customerId) {
      throw new SafeActionError('IDEMPOTENCY_KEY_CONFLICT', 'לא ניתן להשלים את בקשת התוספת. רעננו ונסו שוב.');
    }
    return { request: replayed, replayed: true };
  }

  const currentOrder = await tx.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, customerId: true, status: true, revision: true },
  });
  if (!currentOrder || currentOrder.customerId !== input.customerId) {
    throw new SafeActionError('NOT_FOUND', 'ההזמנה לא נמצאה.');
  }
  assertAdditionAllowed(currentOrder.status);

  const openRequest = await tx.orderAdditionRequest.findFirst({
    where: { orderId: input.orderId, status: { in: ['DRAFT', 'PENDING'] } },
  });
  const financialData = {
    orderRevisionAtSubmission: currentOrder.revision,
    submittedAt: input.now,
    status: 'PENDING' as const,
    subtotal: input.snapshot.subtotal,
    discountTotal: input.snapshot.discountTotal,
    paymentTerm: input.paymentTerm,
    paymentDiscountPercent: input.snapshot.paymentDiscountPercent,
    paymentDiscountTotal: input.snapshot.paymentDiscountTotal,
    total: input.snapshot.total,
    vatRatePercent: input.snapshot.vatRatePercent,
    vatTotal: input.snapshot.vatTotal,
    totalIncludingVat: input.snapshot.totalIncludingVat,
    rejectionReason: null,
    reviewedAt: null,
    reviewedByUserId: null,
  };

  if (openRequest) {
    const updated = await tx.orderAdditionRequest.updateMany({
      where: { id: openRequest.id, revision: openRequest.revision, status: { in: ['DRAFT', 'PENDING'] } },
      data: { ...financialData, lastMutationKey: input.idempotencyKey, revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw new StaleAdditionRequestError();

    await tx.orderAdditionLine.deleteMany({ where: { requestId: openRequest.id } });
    await tx.orderAdditionLine.createMany({ data: toAdditionLines(openRequest.id, input.snapshot) });
    await tx.orderActivity.create({
      data: {
        orderId: input.orderId,
        additionRequestId: openRequest.id,
        actorUserId: input.actorUserId ?? null,
        action: 'ADDITION_SUBMITTED',
        metadata: { edited: true, totalIncludingVat: input.snapshot.totalIncludingVat },
      },
    });
    await appendAuditLog(tx, {
      actorUserId: input.actorUserId ?? null,
      customerId: input.customerId,
      entityType: 'OrderAdditionRequest',
      entityId: openRequest.id,
      action: 'ORDER_ADDITION_SUBMITTED',
      requestId: randomUUID(),
      after: { edited: true, totalIncludingVat: input.snapshot.totalIncludingVat },
    });
    return {
      request: await tx.orderAdditionRequest.findUniqueOrThrow({ where: { id: openRequest.id } }),
      replayed: false,
    };
  }

  const request = await tx.orderAdditionRequest.create({
    data: {
      orderId: input.orderId,
      customerId: input.customerId,
      idempotencyKey: input.idempotencyKey,
      lastMutationKey: input.idempotencyKey,
      ...financialData,
      lines: { create: toNestedAdditionLines(input.snapshot) },
    },
  });
  await tx.orderActivity.create({
    data: {
      orderId: input.orderId,
      additionRequestId: request.id,
      actorUserId: input.actorUserId ?? null,
      action: 'ADDITION_SUBMITTED',
      metadata: { edited: false, totalIncludingVat: input.snapshot.totalIncludingVat },
    },
  });
  await appendAuditLog(tx, {
    actorUserId: input.actorUserId ?? null,
    customerId: input.customerId,
    entityType: 'OrderAdditionRequest',
    entityId: request.id,
    action: 'ORDER_ADDITION_SUBMITTED',
    requestId: randomUUID(),
    after: { edited: false, totalIncludingVat: input.snapshot.totalIncludingVat },
  });
  return { request, replayed: false };
}

export async function packOrderSafely(tx: AdditionPersistenceClient, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      revision: true,
      customerId: true,
      routeId: true,
      additionRequests: { where: { status: 'PENDING' }, select: { id: true } },
    },
  });
  if (!order) throw new SafeActionError('NOT_FOUND', 'ההזמנה לא נמצאה.');
  if (order.status !== 'APPROVED') {
    throw new SafeActionError('ORDER_LOCKED', 'לא ניתן להעביר את ההזמנה לאריזה מהסטטוס הנוכחי.');
  }
  if (order.additionRequests.length > 0) {
    throw new SafeActionError('ORDER_LOCKED', 'יש לאשר או לדחות את בקשת התוספת לפני אריזת ההזמנה.');
  }

  const updated = await tx.order.updateMany({
    where: { id: order.id, status: 'APPROVED', revision: order.revision },
    data: { status: 'PACKED', revision: { increment: 1 } },
  });
  if (updated.count !== 1) throw new StaleAdditionRequestError();
  return tx.order.findUniqueOrThrow({
    where: { id: order.id },
    select: { id: true, status: true, customerId: true, routeId: true },
  });
}

export async function approveAdditionRequest(
  tx: AdditionPersistenceClient,
  input: { requestId: string; reviewerUserId: string; now: Date },
): Promise<{ orderId: string; customerId: string; replayed: boolean }> {
  const request = await tx.orderAdditionRequest.findUnique({
    where: { id: input.requestId },
    include: { order: true, lines: true },
  });
  if (!request) throw new SafeActionError('NOT_FOUND', 'בקשת התוספת לא נמצאה.');
  if (request.status === 'APPROVED') {
    return { orderId: request.order.id, customerId: request.customerId, replayed: true };
  }
  if (request.status !== 'PENDING') {
    throw new SafeActionError('ORDER_LOCKED', 'בקשת התוספת כבר טופלה ואינה ממתינה לאישור.');
  }
  assertAdditionAllowed(request.order.status);

  const orderUpdate = await tx.order.updateMany({
    where: {
      id: request.order.id,
      revision: request.order.revision,
      status: { in: ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED'] },
    },
    data: {
      subtotal: { increment: Number(request.subtotal) },
      discountTotal: { increment: Number(request.discountTotal) },
      paymentDiscountTotal: { increment: Number(request.paymentDiscountTotal) },
      total: { increment: Number(request.total) },
      vatTotal: { increment: Number(request.vatTotal) },
      totalIncludingVat: { increment: Number(request.totalIncludingVat) },
      revision: { increment: 1 },
    },
  });
  if (orderUpdate.count !== 1) throw new StaleAdditionRequestError();

  await tx.orderLine.createMany({
    data: request.lines.map((line) => ({
      orderId: request.order.id,
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

  const requestUpdate = await tx.orderAdditionRequest.updateMany({
    where: { id: request.id, revision: request.revision, status: 'PENDING' },
    data: {
      status: 'APPROVED',
      reviewedAt: input.now,
      reviewedByUserId: input.reviewerUserId,
      revision: { increment: 1 },
    },
  });
  if (requestUpdate.count !== 1) throw new StaleAdditionRequestError();
  await tx.orderActivity.create({
    data: {
      orderId: request.order.id,
      additionRequestId: request.id,
      actorUserId: input.reviewerUserId,
      action: 'ADDITION_APPROVED',
      metadata: { totalIncludingVat: Number(request.totalIncludingVat) },
    },
  });
  await appendAuditLog(tx, {
    actorUserId: input.reviewerUserId,
    actorRole: 'ADMIN',
    customerId: request.customerId,
    entityType: 'OrderAdditionRequest',
    entityId: request.id,
    action: 'ORDER_ADDITION_APPROVED',
    requestId: randomUUID(),
    before: { status: request.status },
    after: { status: 'APPROVED', totalIncludingVat: Number(request.totalIncludingVat) },
  });
  return { orderId: request.order.id, customerId: request.customerId, replayed: false };
}

export async function rejectAdditionRequest(
  tx: AdditionPersistenceClient,
  input: { requestId: string; reviewerUserId: string; reason: string; now: Date },
): Promise<{ orderId: string; customerId: string; replayed: boolean }> {
  const request = await tx.orderAdditionRequest.findUnique({
    where: { id: input.requestId },
    include: { order: { select: { id: true } } },
  });
  if (!request) throw new SafeActionError('NOT_FOUND', 'בקשת התוספת לא נמצאה.');
  if (request.status === 'REJECTED') {
    return { orderId: request.order.id, customerId: request.customerId, replayed: true };
  }
  if (request.status !== 'PENDING') {
    throw new SafeActionError('ORDER_LOCKED', 'בקשת התוספת כבר טופלה ואינה ממתינה לאישור.');
  }

  const updated = await tx.orderAdditionRequest.updateMany({
    where: { id: request.id, revision: request.revision, status: 'PENDING' },
    data: {
      status: 'REJECTED',
      rejectionReason: input.reason,
      reviewedAt: input.now,
      reviewedByUserId: input.reviewerUserId,
      revision: { increment: 1 },
    },
  });
  if (updated.count !== 1) throw new StaleAdditionRequestError();
  await tx.orderActivity.create({
    data: {
      orderId: request.order.id,
      additionRequestId: request.id,
      actorUserId: input.reviewerUserId,
      action: 'ADDITION_REJECTED',
      metadata: { reason: input.reason },
    },
  });
  await appendAuditLog(tx, {
    actorUserId: input.reviewerUserId,
    actorRole: 'ADMIN',
    customerId: request.customerId,
    entityType: 'OrderAdditionRequest',
    entityId: request.id,
    action: 'ORDER_ADDITION_REJECTED',
    requestId: randomUUID(),
    before: { status: request.status },
    after: { status: 'REJECTED', reason: input.reason },
  });
  return { orderId: request.order.id, customerId: request.customerId, replayed: false };
}

function toAdditionLines(requestId: string, snapshot: OrderAdditionSnapshot) {
  return snapshot.lines.map((line) => ({
    requestId,
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
  }));
}

function toNestedAdditionLines(snapshot: OrderAdditionSnapshot) {
  return snapshot.lines.map((line) => ({
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
  }));
}
