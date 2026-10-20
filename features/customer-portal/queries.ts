import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { customerCatalogInclude, priceCustomerCatalog } from '../catalog/customer-catalog';
import { toAdditionRequestView, additionRequestViewInclude } from '../order-additions/view-model';
import { canAddItems, placedOrderStatuses } from '../orders/status';
import { getEffectiveVatRate } from '../orders/tax-rates';
import { orderWithLinesInclude, toOrderView } from '../orders/view-model';
import { loadActivePromotions } from '../pricing/promotions';
import { resolveRouteSchedule } from '../routes/schedule';
import type { CartSeed, CustomerOrderDetail, CustomerPortalData, PortalCustomer } from './types';

const reorderableStatuses = placedOrderStatuses.filter((status) => status !== 'CANCELLED');

export async function getCustomerPortalData(customerId: string, now: Date = new Date()): Promise<CustomerPortalData> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { ...customerCatalogInclude, recommendations: { where: { isActive: true }, select: { productId: true } } },
  });
  if (!customer) notFound();

  const schedule = resolveRouteSchedule(customer.route, now);
  const [promotions, vatRate, activeOrder, draft, lastOrder] = await Promise.all([
    loadActivePromotions(prisma),
    getEffectiveVatRate(now),
    prisma.order.findFirst({
      where: { customerId, deliveryWindowStart: schedule.deliveryAt, status: { in: reorderableStatuses } },
      select: { id: true, orderNumber: true },
    }),
    prisma.order.findFirst({
      where: { customerId, deliveryWindowStart: schedule.deliveryAt, status: 'DRAFT' },
      include: { lines: true },
    }),
    prisma.order.findFirst({
      where: { customerId, status: { in: reorderableStatuses } },
      include: { lines: true },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  const recommendedIds = new Set(customer.recommendations.map((item) => item.productId));
  const previousIds = new Set(lastOrder?.lines.map((line) => line.productId) ?? []);
  const seedOrder = draft ?? lastOrder;
  const cartSeed: CartSeed = seedOrder
    ? {
        source: draft ? 'DRAFT' : 'PREVIOUS_ORDER',
        orderNumber: draft ? null : seedOrder.orderNumber,
        lines: seedOrder.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      }
    : { source: 'EMPTY', orderNumber: null, lines: [] };

  return {
    customer: { id: customer.id, name: customer.name, contact: customer.contact },
    schedule: {
      routeName: customer.route.name,
      deliveryAt: schedule.deliveryAt.toISOString(),
      cutoffAt: schedule.cutoffAt.toISOString(),
      isPastCutoff: now.getTime() > schedule.cutoffAt.getTime(),
      opsContactName: customer.route.opsContactName,
      opsContactPhone: customer.route.opsContactPhone,
    },
    products: priceCustomerCatalog(customer, promotions, now).map((product) => ({
      ...product,
      isRecommended: recommendedIds.has(product.id),
      isPreviousOrder: previousIds.has(product.id),
    })),
    vatRatePercent: vatRate.ratePercent,
    cartSeed,
    activeOrder,
  };
}

export async function getPortalCustomer(customerId: string): Promise<PortalCustomer> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, contact: true } });
  if (!customer) notFound();
  return customer;
}

export async function getCustomerOrderById(customerId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId, status: { in: placedOrderStatuses } },
    include: orderWithLinesInclude,
  });
  return order ? toOrderView(order) : null;
}

export async function getCustomerOrderDetail(customerId: string, orderNumber: number): Promise<CustomerOrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: { customerId, orderNumber, status: { in: placedOrderStatuses } },
    include: {
      ...orderWithLinesInclude,
      additionRequests: { include: additionRequestViewInclude, orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }], take: 1 },
    },
  });
  if (!order) return null;

  return {
    order: toOrderView(order),
    canAddItems: canAddItems(order.status),
    latestAddition: order.additionRequests[0] ? toAdditionRequestView(order.additionRequests[0]) : null,
  };
}
