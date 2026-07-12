'use server';

import { revalidatePath } from 'next/cache';
import { createSubmittedOrder, getOrderWriteContext } from '@/features/orders/service';
import { actionError, actionOk, type ActionResult } from '@/lib/action-result';
import { assertCustomerAction } from '@/lib/authorization';
import { prisma } from '@/lib/db';
import { enqueueOrderLifecycleWhatsApp } from '../notifications/jobs';
import { normalizeCustomerOrderItems } from '../orders/utils';
import { calculateOrderPricing } from '../pricing/engine';
import { saveDraftOrderSchema, submitCustomerOrderSchema, type SaveDraftOrderInput, type SubmitCustomerOrderInput } from './schema';

export async function saveDraftOrderAction(input: SaveDraftOrderInput): Promise<ActionResult<{ orderId: string | null }>> {
  try {
    const parsed = saveDraftOrderSchema.parse(input);
    await assertCustomerAction(parsed.customerId);

    const context = await getOrderWriteContext(parsed.customerId);
    const normalizedItems = normalizeCustomerOrderItems(parsed.items, context.products);
    if (normalizedItems.length === 0) {
      return actionOk({ orderId: null });
    }

    const pricing = calculateOrderPricing({
      customer: context.customer,
      route: context.route,
      items: normalizedItems,
      products: context.products,
      priceListItems: context.priceListItems,
      promotions: context.promotions,
    });
    const snapshotLines = pricing.lines;
    const existingDraft = await prisma.order.findFirst({
      where: {
        customerId: parsed.customerId,
        status: 'DRAFT',
        deliveryWindowStart: context.route.nextDeliveryAt,
      },
    });

    const order = await prisma.order.upsert({
      where: {
        id: existingDraft?.id ?? '__new_draft__',
      },
      create: {
        customerId: parsed.customerId,
        routeId: context.route.id,
        status: 'DRAFT',
        source: 'CUSTOMER',
        deliveryWindowStart: context.route.nextDeliveryAt,
        deadlineAt: context.route.nextCutoffAt,
        subtotal: pricing.subtotal,
        discountTotal: pricing.discountTotal,
        total: pricing.total,
        lines: {
          create: snapshotLines.map((line) => ({
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
          })),
        },
      },
      update: {
        routeId: context.route.id,
        deliveryWindowStart: context.route.nextDeliveryAt,
        deadlineAt: context.route.nextCutoffAt,
        subtotal: pricing.subtotal,
        discountTotal: pricing.discountTotal,
        total: pricing.total,
        lines: {
          deleteMany: {},
          create: snapshotLines.map((line) => ({
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
          })),
        },
      },
    });

    revalidatePath(`/customer/${parsed.customerId}`);
    return actionOk({ orderId: order.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function submitCustomerOrderAction(input: SubmitCustomerOrderInput): Promise<ActionResult<{ orderId: string; status: string }>> {
  try {
    const parsed = submitCustomerOrderSchema.parse(input);
    await assertCustomerAction(parsed.customerId);

    const context = await getOrderWriteContext(parsed.customerId);
    const normalizedItems = normalizeCustomerOrderItems(parsed.items, context.products);
    if (normalizedItems.length === 0) {
      throw new Error('לא ניתן לשלוח הזמנה ריקה.');
    }

    const order = await createSubmittedOrder({
      customerId: parsed.customerId,
      items: normalizedItems,
      source: 'CUSTOMER',
      notes: parsed.notes,
      replaceDraftForDeliveryWindow: true,
    });

    revalidatePath('/admin');
    revalidatePath(`/admin/routes/${order.routeId}`);
    revalidatePath(`/admin/customers/${parsed.customerId}`);
    revalidatePath(`/customer/${parsed.customerId}`);
    await enqueueOrderLifecycleSafely({ orderId: order.orderId });

    return actionOk({ orderId: order.orderId, status: order.status });
  } catch (error) {
    return actionError(error);
  }
}

async function enqueueOrderLifecycleSafely(input: Parameters<typeof enqueueOrderLifecycleWhatsApp>[0]) {
  try {
    await enqueueOrderLifecycleWhatsApp(input);
  } catch (error) {
    console.error('Failed to enqueue WhatsApp order lifecycle notification', error);
  }
}
