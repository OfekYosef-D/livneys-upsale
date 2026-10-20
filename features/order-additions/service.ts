import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { runSerializable } from '@/lib/transactions';
import type { RecordAudit } from '../audit/log';
import type { OrderItem } from '../orders/quantity';
import { getOrderWriteContext } from '../orders/service';
import { approveAdditionRequest, assertAdditionAllowed, persistPendingAdditionRequest, rejectAdditionRequest } from './persistence';
import { buildOrderAdditionSnapshot } from './pricing';

type Actor = { userId: string; audit: RecordAudit };

export async function submitOrderAddition({
  customerId,
  orderId,
  idempotencyKey,
  items,
  actor,
  now = new Date(),
}: {
  customerId: string;
  orderId: string;
  idempotencyKey: string;
  items: OrderItem[];
  actor: Actor;
  now?: Date;
}): Promise<{ requestId: string; replayed: boolean }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: { id: true, status: true, paymentTerm: true, vatRatePercent: true, lines: { select: { productId: true, quantity: true } } },
  });
  if (!order) throw new NotFoundError('ההזמנה לא נמצאה.');
  assertAdditionAllowed(order.status);

  // Additions are billed at the VAT rate the original order was placed with.
  const context = { ...(await getOrderWriteContext(customerId, now)), vatRatePercent: Number(order.vatRatePercent) };
  const snapshot = buildOrderAdditionSnapshot({
    context,
    existingItems: order.lines.flatMap((line) => (line.productId ? [{ productId: line.productId, quantity: line.quantity }] : [])),
    items,
    paymentTerm: order.paymentTerm,
    now,
  });

  const { request, replayed } = await runSerializable((tx) =>
    persistPendingAdditionRequest(tx, {
      orderId: order.id,
      customerId,
      paymentTerm: order.paymentTerm,
      idempotencyKey,
      snapshot,
      now,
      actorUserId: actor.userId,
      audit: actor.audit,
    }));
  return { requestId: request.id, replayed };
}

export function reviewOrderAddition({
  requestId,
  decision,
  reason,
  actor,
  now = new Date(),
}: {
  requestId: string;
  decision: 'APPROVED' | 'REJECTED';
  reason: string | null;
  actor: Actor;
  now?: Date;
}) {
  const input = { requestId, reviewerUserId: actor.userId, now, audit: actor.audit };
  return runSerializable((tx) =>
    decision === 'APPROVED'
      ? approveAdditionRequest(tx, input)
      : rejectAdditionRequest(tx, { ...input, reason: reason ?? '' }));
}
