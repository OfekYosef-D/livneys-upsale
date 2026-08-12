'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import {
  cancelDraftOrder,
  isRetryableOrderWriteError,
  persistDraftOrder,
  StaleOrderWriteError,
} from '@/features/orders/persistence';
import { createSubmittedOrder, getOrderWriteContext } from '@/features/orders/service';
import { actionError, actionOk, SafeActionError, type ActionResult } from '@/lib/action-result';
import { assertCustomerAction } from '@/lib/authorization';
import { prisma } from '@/lib/db';
import { enqueueOrderLifecycleWhatsApp } from '../notifications/jobs';
import { normalizeCustomerOrderItems } from '../orders/utils';
import { calculateVatSummary } from '../orders/vat';
import { calculateOrderPricing } from '../pricing/engine';
import { saveDraftOrderSchema, submitCustomerOrderSchema, type SaveDraftOrderInput, type SubmitCustomerOrderInput } from './schema';

export async function saveDraftOrderAction(input: SaveDraftOrderInput): Promise<ActionResult<{ orderId: string | null }>> {
  try {
    const parsed = saveDraftOrderSchema.parse(input);
    await assertCustomerAction(parsed.customerId);

    const context = await getOrderWriteContext(parsed.customerId);
    const normalizedItems = normalizeCustomerOrderItems(parsed.items, context.products);
    if (normalizedItems.length === 0) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await prisma.$transaction(
            (tx) => cancelDraftOrder(tx, {
              customerId: parsed.customerId,
              deliveryWindowStart: context.route.nextDeliveryAt,
            }),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          );
          break;
        } catch (error) {
          if (!isRetryableOrderWriteError(error) || attempt === 3) throw error;
        }
      }

      revalidatePath(`/customer/${parsed.customerId}`);
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
    const vat = calculateVatSummary(pricing.total, context.vatRatePercent);
    const draftPayload = {
      order: {
        customerId: parsed.customerId,
        routeId: context.route.id,
        status: 'DRAFT' as const,
        source: 'CUSTOMER' as const,
        deliveryWindowStart: context.route.nextDeliveryAt,
        deadlineAt: context.route.nextCutoffAt,
        submittedAt: null,
        notes: null,
        internalNote: null,
        subtotal: pricing.subtotal,
        discountTotal: pricing.discountTotal,
        paymentTerm: 'NET_30' as const,
        paymentDiscountPercent: 0,
        paymentDiscountTotal: 0,
        total: pricing.total,
        vatRatePercent: vat.vatRatePercent,
        vatTotal: vat.vatTotal,
        totalIncludingVat: vat.totalIncludingVat,
        commercialTermsVersion: null,
        commercialTermsAcceptedAt: null,
      },
      lines: snapshotLines,
    };

    let orderId: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const persisted = await prisma.$transaction(
          (tx) => persistDraftOrder(tx, { payload: draftPayload }),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        orderId = persisted.order.id;
        break;
      } catch (error) {
        const retryable = error instanceof StaleOrderWriteError || isRetryableOrderWriteError(error);
        if (!retryable || attempt === 3) throw error;
      }
    }

    if (!orderId) {
      throw new Error('Draft persistence retry loop exited unexpectedly.');
    }

    revalidatePath(`/customer/${parsed.customerId}`);
    return actionOk({ orderId });
  } catch (error) {
    return actionError(error);
  }
}

export async function submitCustomerOrderAction(input: SubmitCustomerOrderInput): Promise<ActionResult<{ orderId: string; status: string }>> {
  try {
    const parsed = submitCustomerOrderSchema.parse(input);
    const session = await assertCustomerAction(parsed.customerId);

    const context = await getOrderWriteContext(parsed.customerId);
    const normalizedItems = normalizeCustomerOrderItems(parsed.items, context.products);
    if (normalizedItems.length === 0) {
      throw new SafeActionError('VALIDATION_ERROR', 'לא ניתן לשלוח הזמנה ריקה.');
    }

    const order = await createSubmittedOrder({
      customerId: parsed.customerId,
      items: normalizedItems,
      source: 'CUSTOMER',
      idempotencyKey: parsed.idempotencyKey,
      paymentTerm: parsed.paymentTerm,
      commercialTermsAccepted: parsed.commercialTermsAccepted,
      notes: parsed.notes,
      replaceDraftForDeliveryWindow: true,
      actorUserId: session.user.id,
      expectedVatRatePercent: parsed.vatRatePercent,
      expectedLegalDocumentSetVersion: parsed.legalDocumentSetVersion,
    });

    revalidatePath('/admin');
    revalidatePath(`/admin/routes/${order.routeId}`);
    revalidatePath(`/admin/customers/${parsed.customerId}`);
    revalidatePath(`/customer/${parsed.customerId}`);
    if (!order.replayed) {
      await enqueueOrderLifecycleSafely({ orderId: order.orderId });
    }

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
