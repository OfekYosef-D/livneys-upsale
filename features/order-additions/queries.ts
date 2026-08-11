import type { OrderStatus } from '@prisma/client';
import { prisma } from '../../lib/db';
import { mapPortalOrder } from '../customer-portal/order-mapping';

const existingOrderStatuses: OrderStatus[] = ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED', 'PACKED', 'DELIVERED'];

export async function getActiveOrderForDelivery(customerId: string, deliveryWindowStart: Date) {
  return prisma.order.findFirst({
    where: { customerId, deliveryWindowStart, status: { in: existingOrderStatuses } },
    select: { id: true, orderNumber: true },
  });
}

export async function getCustomerOrderAdditionData(customerId: string, orderNumber: number) {
  const order = await prisma.order.findFirst({
    where: { customerId, orderNumber, status: { not: 'DRAFT' } },
    include: {
      lines: true,
      additionRequests: {
        include: { lines: true },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        take: 1,
      },
    },
  });
  if (!order) return null;

  const addition = order.additionRequests[0] ?? null;
  return {
    order: mapPortalOrder(order, customerId),
    deliveryWindowStart: order.deliveryWindowStart.toISOString(),
    canAddItems: ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED'].includes(order.status),
    additionRequest: addition ? {
      id: addition.id,
      status: addition.status,
      revision: addition.revision,
      rejectionReason: addition.rejectionReason,
      subtotal: Number(addition.subtotal),
      discountTotal: Number(addition.discountTotal),
      paymentDiscountPercent: Number(addition.paymentDiscountPercent),
      paymentDiscountTotal: Number(addition.paymentDiscountTotal),
      total: Number(addition.total),
      vatRatePercent: Number(addition.vatRatePercent),
      vatTotal: Number(addition.vatTotal),
      totalIncludingVat: Number(addition.totalIncludingVat),
      submittedAt: addition.submittedAt.toISOString(),
      lines: addition.lines.map((line) => ({
        productId: line.productId ?? '',
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice),
        lineTotal: Number(line.lineTotal),
      })),
    } : null,
  };
}
