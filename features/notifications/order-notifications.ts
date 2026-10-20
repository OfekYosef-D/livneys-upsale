import { after } from 'next/server';
import { prisma } from '@/lib/db';
import type { OrderStatus } from '../orders/status';
import { getAppBaseUrl } from './config';
import { deliverNow, enqueueNotification } from './jobs';
import { buildAdditionDecisionContent, buildOrderStatusContent, getTemplateKeyForOrderStatus } from './templates';

const recipientSelect = {
  id: true,
  name: true,
  contact: true,
  email: true,
  phone: true,
  isActive: true,
  notificationPreference: { select: { emailEnabled: true, whatsappEnabled: true } },
} as const;

/** Tells the customer about their order's current status on every channel they opted into. */
export async function notifyOrderStatus(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true, totalIncludingVat: true, deliveryWindowStart: true, customer: { select: recipientSelect } },
  });
  const templateKey = order ? getTemplateKeyForOrderStatus(order.status as OrderStatus) : null;
  if (!order || !templateKey) return;

  const jobIds = await enqueueNotification({
    customerId: order.customer.id,
    recipient: order.customer,
    orderId: order.id,
    dedupeKey: `order:${order.id}:${templateKey}`,
    content: buildOrderStatusContent({
      templateKey,
      baseUrl: getAppBaseUrl(),
      customer: order.customer,
      order: { ...order, totalIncludingVat: Number(order.totalIncludingVat) },
    }),
  });
  await deliverNow(jobIds);
}

export async function notifyAdditionDecision(requestId: string, decision: 'APPROVED' | 'REJECTED'): Promise<void> {
  const request = await prisma.orderAdditionRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, rejectionReason: true, order: { select: { id: true, orderNumber: true } }, customer: { select: recipientSelect } },
  });
  if (!request || request.status !== decision) return;

  const jobIds = await enqueueNotification({
    customerId: request.customer.id,
    recipient: request.customer,
    orderId: request.order.id,
    dedupeKey: `addition:${request.id}:${decision}`,
    content: buildAdditionDecisionContent({
      baseUrl: getAppBaseUrl(),
      customer: request.customer,
      orderNumber: request.order.orderNumber,
      decision,
      rejectionReason: request.rejectionReason,
    }),
  });
  await deliverNow(jobIds);
}

/**
 * Notifications run after the response is sent: the user is not kept waiting on the email
 * provider, and a provider outage can never fail the order itself (the job stays queued).
 */
function inBackground(label: string, task: () => Promise<void>) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`Failed to queue ${label} notification`, error);
    }
  });
}

export function notifyOrderStatusInBackground(orderId: string) {
  inBackground('order status', () => notifyOrderStatus(orderId));
}

export function notifyAdditionDecisionInBackground(requestId: string, decision: 'APPROVED' | 'REJECTED') {
  inBackground('order addition', () => notifyAdditionDecision(requestId, decision));
}
