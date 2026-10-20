'use server';

import { customerAction } from '@/lib/server-action';
import { notifyOrderStatusInBackground } from '../notifications/order-notifications';
import { saveDraftOrder, submitOrder } from '../orders/service';
import { saveDraftOrderSchema, submitCustomerOrderSchema } from './schema';

export const saveDraftOrderAction = customerAction(saveDraftOrderSchema, async ({ customerId, items }) =>
  saveDraftOrder(customerId, items));

export const submitCustomerOrderAction = customerAction(submitCustomerOrderSchema, async (input, ctx) => {
  const order = await submitOrder({
    customerId: input.customerId,
    items: input.items,
    source: 'CUSTOMER',
    idempotencyKey: input.idempotencyKey,
    paymentTerm: input.paymentTerm,
    commercialTermsAccepted: input.commercialTermsAccepted,
    notes: input.notes,
    expectedVatRatePercent: input.vatRatePercent,
    expectedLegalDocumentSetVersion: input.legalDocumentSetVersion,
    actor: { userId: ctx.actorUserId, audit: ctx.audit },
  });

  if (!order.replayed) notifyOrderStatusInBackground(order.orderId);
  return { orderId: order.orderId, status: order.status };
});
