'use server';

import { adminAction } from '@/lib/server-action';
import { fields, z } from '@/lib/validation';
import { notifyOrderStatusInBackground } from '../../notifications/order-notifications';
import { changeOrderStatus, submitOrder } from '../../orders/service';
import { orderStatusValues } from '../../orders/status';
import { formatManualOrderInternalNote } from '../../orders/write';
import { manualOrderSchema } from '../schemas';

/** Phone / WhatsApp orders typed in by the team. No minimum and no B2B declaration are required. */
export const createManualOrderAction = adminAction(manualOrderSchema, async (input, ctx) => {
  const order = await submitOrder({
    customerId: input.customerId,
    items: input.items,
    source: 'ADMIN',
    idempotencyKey: input.idempotencyKey,
    paymentTerm: 'NET_30',
    expectedVatRatePercent: input.vatRatePercent,
    notes: input.notes,
    internalNote: formatManualOrderInternalNote({ intakeChannel: input.intakeChannel, note: input.internalNote }),
    actor: { userId: ctx.actorUserId, audit: ctx.audit },
  });
  if (!order.replayed) notifyOrderStatusInBackground(order.orderId);
  return { orderId: order.orderId, status: order.status };
});

export const updateOrderStatusAction = adminAction(
  z.object({ orderId: fields.id, status: z.enum(orderStatusValues) }),
  async ({ orderId, status }, ctx) => {
    const result = await changeOrderStatus({ orderId, status, audit: ctx.audit });
    notifyOrderStatusInBackground(result.orderId);
    return result;
  },
);
