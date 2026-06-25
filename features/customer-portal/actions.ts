'use server';

import { revalidatePath } from 'next/cache';
import { createOrderSnapshotLines, getSubmissionStatus } from '@/features/orders/utils';
import { isAfterCutoff } from '@/features/routes/utils';
import { actionError, actionOk, type ActionResult } from '@/lib/action-result';
import { assertCustomerAction } from '@/lib/authorization';
import { prisma } from '@/lib/db';
import { saveDraftOrderSchema, submitCustomerOrderSchema, type SaveDraftOrderInput, type SubmitCustomerOrderInput } from './schema';

export async function saveDraftOrderAction(input: SaveDraftOrderInput): Promise<ActionResult<{ orderId: string | null }>> {
  try {
    const parsed = saveDraftOrderSchema.parse(input);
    await assertCustomerAction(parsed.customerId);

    const items = parsed.items.filter((item) => item.qty > 0);
    if (items.length === 0) {
      return actionOk({ orderId: null });
    }

    const context = await getOrderWriteContext(parsed.customerId);
    const snapshotLines = createOrderSnapshotLines({
      items: items.map((item) => ({ productId: item.productId, quantity: item.qty })),
      products: context.products,
    });
    const total = snapshotLines.reduce((sum, line) => sum + line.lineTotal, 0);
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
        total,
        lines: {
          create: snapshotLines.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          })),
        },
      },
      update: {
        routeId: context.route.id,
        deliveryWindowStart: context.route.nextDeliveryAt,
        deadlineAt: context.route.nextCutoffAt,
        total,
        lines: {
          deleteMany: {},
          create: snapshotLines.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
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

    const items = parsed.items.filter((item) => item.qty > 0);
    if (items.length === 0) {
      throw new Error('לא ניתן לשלוח הזמנה ריקה.');
    }

    const context = await getOrderWriteContext(parsed.customerId);
    const snapshotLines = createOrderSnapshotLines({
      items: items.map((item) => ({ productId: item.productId, quantity: item.qty })),
      products: context.products,
    });
    const total = snapshotLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const now = new Date();
    const status = getSubmissionStatus({
      now,
      cutoff: context.route.nextCutoffAt,
    });
    const existingDraft = await prisma.order.findFirst({
      where: {
        customerId: parsed.customerId,
        status: 'DRAFT',
        deliveryWindowStart: context.route.nextDeliveryAt,
      },
    });

    const order = await prisma.order.upsert({
      where: {
        id: existingDraft?.id ?? '__new_submission__',
      },
      create: {
        customerId: parsed.customerId,
        routeId: context.route.id,
        status,
        source: 'CUSTOMER',
        deliveryWindowStart: context.route.nextDeliveryAt,
        deadlineAt: context.route.nextCutoffAt,
        submittedAt: now,
        notes: parsed.notes,
        total,
        lines: {
          create: snapshotLines.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          })),
        },
      },
      update: {
        routeId: context.route.id,
        status,
        submittedAt: now,
        notes: parsed.notes,
        total,
        lines: {
          deleteMany: {},
          create: snapshotLines.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          })),
        },
      },
    });

    revalidatePath('/admin');
    revalidatePath(`/admin/routes/${context.route.id}`);
    revalidatePath(`/admin/customers/${parsed.customerId}`);
    revalidatePath(`/customer/${parsed.customerId}`);

    return actionOk({ orderId: order.id, status });
  } catch (error) {
    return actionError(error);
  }
}

async function getOrderWriteContext(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      route: true,
      priceList: {
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  if (!customer || !customer.isActive) {
    throw new Error('לקוח לא נמצא או אינו פעיל.');
  }

  if (isAfterCutoff({ now: new Date(), cutoff: customer.route.nextCutoffAt })) {
    // The status assignment happens in submit; this call documents the business rule at the data boundary.
  }

  return {
    customer,
    route: customer.route,
    products: customer.priceList.items
      .filter((item) => item.product.isActive)
      .map((item) => ({
        id: item.productId,
        name: item.product.name,
        price: Number(item.price),
      })),
  };
}
