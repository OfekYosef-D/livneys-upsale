'use server';

import { adminAction, customerAction } from '@/lib/server-action';
import { notifyAdditionDecisionInBackground } from '../notifications/order-notifications';
import { submitOrderAdditionSchema, reviewOrderAdditionSchema } from './schemas';
import { reviewOrderAddition, submitOrderAddition } from './service';

export const submitOrderAdditionAction = customerAction(submitOrderAdditionSchema, async (input, ctx) => {
  const { requestId } = await submitOrderAddition({ ...input, actor: { userId: ctx.actorUserId, audit: ctx.audit } });
  return { requestId };
});

/** The team records an addition on the customer's behalf (e.g. a phone call); it is approved immediately. */
export const createApprovedOrderAdditionAction = adminAction(submitOrderAdditionSchema, async (input, ctx) => {
  const actor = { userId: ctx.actorUserId, audit: ctx.audit };
  const { requestId } = await submitOrderAddition({ ...input, actor });
  const reviewed = await reviewOrderAddition({ requestId, decision: 'APPROVED', reason: null, actor });
  // A retried submit replays an approval that was already announced; do not message the customer twice.
  if (!reviewed.replayed) notifyAdditionDecisionInBackground(requestId, 'APPROVED');
  return { orderId: reviewed.orderId, requestId };
});

export const reviewOrderAdditionAction = adminAction(reviewOrderAdditionSchema, async (input, ctx) => {
  const result = await reviewOrderAddition({ ...input, actor: { userId: ctx.actorUserId, audit: ctx.audit } });
  if (!result.replayed) notifyAdditionDecisionInBackground(input.requestId, input.decision);
  return { orderId: result.orderId, status: input.decision };
});
