'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionResult } from '../../lib/action-result';
import { assertAdminAction, assertCustomerAction } from '../../lib/authorization';
import { prisma } from '../../lib/db';
import { enqueueOrderAdditionDecisionNotifications } from './notifications';
import { approveAdditionRequest, rejectAdditionRequest } from './persistence';
import { reviewOrderAdditionSchema, submitOrderAdditionSchema } from './schemas';
import { submitOrderAddition } from './service';
import { isRetryableOrderWriteError } from '../orders/persistence';

export async function submitOrderAdditionAction(input: unknown): Promise<ActionResult<{ requestId: string; status: string }>> {
  try {
    const parsed = submitOrderAdditionSchema.parse(input);
    const session = await assertCustomerAction(parsed.customerId);
    const result = await submitOrderAddition({
      ...parsed,
      actorUserId: session.user.id,
    });
    revalidateAdditionPaths(parsed.customerId, parsed.orderId);
    return actionOk({ requestId: result.requestId, status: result.status });
  } catch (error) {
    return actionError(error);
  }
}

export async function createApprovedOrderAdditionAction(input: unknown): Promise<ActionResult<{ orderId: string; requestId: string; status: 'APPROVED' }>> {
  try {
    const parsed = submitOrderAdditionSchema.parse(input);
    const session = await assertAdminAction();
    const submitted = await submitOrderAddition({ ...parsed, actorUserId: session.user.id });
    const reviewed = await runReviewTransaction((tx) => approveAdditionRequest(tx, {
        requestId: submitted.requestId,
        reviewerUserId: session.user.id,
        now: new Date(),
      }));
    revalidateAdditionPaths(reviewed.customerId, reviewed.orderId);
    if (!reviewed.replayed) {
      await enqueueDecisionNotificationsSafely(submitted.requestId, 'APPROVED');
    }
    return actionOk({ orderId: reviewed.orderId, requestId: submitted.requestId, status: 'APPROVED' });
  } catch (error) {
    return actionError(error);
  }
}

export async function reviewOrderAdditionAction(input: unknown): Promise<ActionResult<{ orderId: string; status: 'APPROVED' | 'REJECTED' }>> {
  try {
    const parsed = reviewOrderAdditionSchema.parse(input);
    const session = await assertAdminAction();
    const now = new Date();
    const result = await runReviewTransaction(
      (tx) => parsed.decision === 'APPROVED'
        ? approveAdditionRequest(tx, { requestId: parsed.requestId, reviewerUserId: session.user.id, now })
        : rejectAdditionRequest(tx, {
            requestId: parsed.requestId,
            reviewerUserId: session.user.id,
            reason: parsed.reason!,
            now,
          }),
    );
    revalidateAdditionPaths(result.customerId, result.orderId);
    if (!result.replayed) {
      await enqueueDecisionNotificationsSafely(parsed.requestId, parsed.decision);
    }
    return actionOk({ orderId: result.orderId, status: parsed.decision });
  } catch (error) {
    return actionError(error);
  }
}

function revalidateAdditionPaths(customerId: string, orderId: string) {
  revalidatePath('/admin');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/customer/${customerId}`);
}

async function enqueueDecisionNotificationsSafely(requestId: string, decision: 'APPROVED' | 'REJECTED') {
  try {
    await enqueueOrderAdditionDecisionNotifications({ requestId, decision });
  } catch (error) {
    console.error('Failed to enqueue order addition decision notifications', error);
  }
}

async function runReviewTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isRetryableOrderWriteError(error) || attempt === 3) throw error;
    }
  }
  throw new Error('Addition review retry loop exited unexpectedly.');
}
