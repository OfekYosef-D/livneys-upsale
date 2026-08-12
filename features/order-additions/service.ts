import { Prisma } from '@prisma/client';
import { getOrderWriteContext } from '../orders/service';
import { isRetryableOrderWriteError } from '../orders/persistence';
import { SafeActionError } from '../../lib/safe-action-error';
import { prisma } from '../../lib/db';
import { assertAdditionAllowed } from './business-rules';
import { persistPendingAdditionRequest } from './persistence';
import { buildOrderAdditionSnapshot } from './pricing';

export async function submitOrderAddition({
  customerId,
  orderId,
  idempotencyKey,
  items,
  actorUserId,
  now = new Date(),
}: {
  customerId: string;
  orderId: string;
  idempotencyKey: string;
  items: Array<{ productId: string; quantity: number }>;
  actorUserId?: string | null;
  now?: Date;
}): Promise<{ requestId: string; status: string; replayed: boolean }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: {
      id: true,
      customerId: true,
      status: true,
      revision: true,
      paymentTerm: true,
      deliveryWindowStart: true,
      lines: { select: { productId: true, quantity: true } },
    },
  });
  if (!order) throw new SafeActionError('NOT_FOUND', 'ההזמנה לא נמצאה.');
  assertAdditionAllowed(order.status);

  const context = await getOrderWriteContext(customerId, now);
  const snapshot = buildOrderAdditionSnapshot({
    context,
    existingItems: order.lines.flatMap((line) => line.productId
      ? [{ productId: line.productId, quantity: line.quantity }]
      : []),
    items,
    paymentTerm: order.paymentTerm,
    now,
  });
  let persisted: Awaited<ReturnType<typeof persistPendingAdditionRequest>> | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      persisted = await prisma.$transaction(
        (tx) => persistPendingAdditionRequest(tx, {
          orderId: order.id,
          customerId,
          orderRevision: order.revision,
          paymentTerm: order.paymentTerm,
          idempotencyKey,
          snapshot,
          now,
          actorUserId,
        }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      break;
    } catch (error) {
      if (!isRetryableOrderWriteError(error) || attempt === 3) throw error;
    }
  }
  if (!persisted) throw new Error('Addition persistence retry loop exited unexpectedly.');

  return {
    requestId: persisted.request.id,
    status: persisted.request.status,
    replayed: persisted.replayed,
  };
}
