import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { additionRequestViewInclude, toAdditionRequestView } from '../order-additions/view-model';
import { openOrderStatuses, placedOrderStatuses } from '../orders/status';
import { orderWithLinesInclude, toOrderView, type OrderView } from '../orders/view-model';
import { getPaymentSummary } from '../payments/service';
import { resolveRouteSchedule } from '../routes/schedule';

/** Demo/QA accounts use the reserved @livneys.local domain and are hidden from operational screens. */
const realCustomers: Prisma.CustomerWhereInput = {
  OR: [{ email: null }, { NOT: { email: { endsWith: '@livneys.local', mode: 'insensitive' } } }],
};

const orderSummaryInclude = {
  ...orderWithLinesInclude,
  customer: { select: { name: true, contact: true, phone: true } },
  route: { select: { name: true } },
} satisfies Prisma.OrderInclude;

type OrderWithParties = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;

export type AdminOrderView = OrderView & {
  customerName: string;
  customerContact: string;
  customerPhone: string;
  routeName: string;
  internalNote: string | null;
};

function toAdminOrderView(order: OrderWithParties): AdminOrderView {
  return {
    ...toOrderView(order),
    customerName: order.customer.name,
    customerContact: order.customer.contact,
    customerPhone: order.customer.phone,
    routeName: order.route?.name ?? 'ללא קו',
    internalNote: order.internalNote,
  };
}

export async function getAdminDashboardData(now: Date = new Date()) {
  const [orders, routes, failedNotifications] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: openOrderStatuses }, customer: realCustomers },
      include: orderSummaryInclude,
      orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
    }),
    prisma.route.findMany({
      where: { isActive: true },
      include: { customers: { where: { isActive: true, ...realCustomers }, select: { id: true, name: true, contact: true, phone: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.notificationJob.count({ where: { status: 'FAILED', customer: realCustomers } }),
  ]);

  const routeSummaries = await Promise.all(routes.map(async (route) => {
    const schedule = resolveRouteSchedule(route, now);
    const ordered = new Set((await prisma.order.findMany({
      where: {
        customerId: { in: route.customers.map((customer) => customer.id) },
        deliveryWindowStart: schedule.deliveryAt,
        status: { in: placedOrderStatuses.filter((status) => status !== 'CANCELLED') },
      },
      select: { customerId: true },
    })).map((order) => order.customerId));

    return {
      id: route.id,
      name: route.name,
      deliveryAt: schedule.deliveryAt.toISOString(),
      cutoffAt: schedule.cutoffAt.toISOString(),
      customerCount: route.customers.length,
      orderedCount: ordered.size,
      missingCustomers: route.customers.filter((customer) => !ordered.has(customer.id)),
    };
  }));

  const orderViews = orders.map(toAdminOrderView);
  return {
    orders: orderViews,
    routes: routeSummaries,
    kpis: {
      needsApproval: orderViews.filter((order) => order.status === 'SUBMITTED' || order.status === 'SPECIAL_REQUEST').length,
      readyForRoute: orderViews.filter((order) => order.status === 'APPROVED' || order.status === 'PACKED').length,
      missingOrders: routeSummaries.reduce((sum, route) => sum + route.missingCustomers.length, 0),
      failedNotifications,
    },
  };
}

export type AdminDashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>;

export async function getAdminRouteDetail(routeId: string, now: Date = new Date()) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: { customers: { where: { isActive: true }, select: { id: true, name: true, contact: true, phone: true }, orderBy: { name: 'asc' } } },
  });
  if (!route) return null;

  const schedule = resolveRouteSchedule(route, now);
  const orders = await prisma.order.findMany({
    where: { routeId, deliveryWindowStart: schedule.deliveryAt, status: { in: placedOrderStatuses } },
    select: { id: true, customerId: true, status: true, orderNumber: true, totalIncludingVat: true },
  });
  const orderByCustomer = new Map(orders.filter((order) => order.status !== 'CANCELLED').map((order) => [order.customerId, order]));

  return {
    id: route.id,
    name: route.name,
    driver: route.driver,
    deliveryAt: schedule.deliveryAt.toISOString(),
    cutoffAt: schedule.cutoffAt.toISOString(),
    customers: route.customers.map((customer) => {
      const order = orderByCustomer.get(customer.id);
      return {
        ...customer,
        order: order ? { id: order.id, orderNumber: order.orderNumber, status: order.status, totalIncludingVat: Number(order.totalIncludingVat) } : null,
      };
    }),
  };
}

export async function getAdminCustomerDetail(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      route: { select: { id: true, name: true } },
      priceList: { select: { name: true } },
      orders: { where: { status: { not: 'DRAFT' } }, include: orderSummaryInclude, orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }], take: 50 },
      recommendations: { where: { isActive: true }, include: { product: { select: { name: true } } }, take: 8 },
      users: { select: { id: true, name: true, email: true, isActive: true, passwordHash: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!customer) return null;

  return {
    id: customer.id,
    name: customer.name,
    contact: customer.contact,
    phone: customer.phone,
    email: customer.email,
    region: customer.region,
    address: customer.address,
    deliveryConstraints: customer.deliveryConstraints,
    notes: customer.notes,
    isActive: customer.isActive,
    routeId: customer.route.id,
    routeName: customer.route.name,
    priceListName: customer.priceList.name,
    users: customer.users.map(({ passwordHash, ...user }) => ({ ...user, setupComplete: Boolean(passwordHash) })),
    orders: customer.orders.map(toAdminOrderView),
    recommendations: customer.recommendations.map((recommendation) => ({ productName: recommendation.product.name, reason: recommendation.reason })),
  };
}

export async function getAdminOrderDetail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      ...orderSummaryInclude,
      additionRequests: { include: additionRequestViewInclude, orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }] },
      paymentReceipts: {
        include: { recordedBy: { select: { name: true } }, voidedBy: { select: { name: true } } },
        orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
      },
      legalAcceptances: { orderBy: { acceptedAt: 'asc' } },
    },
  });
  if (!order) return null;

  const paymentReceipts = order.paymentReceipts.map((receipt) => ({
    id: receipt.id,
    amount: Number(receipt.amount),
    method: receipt.method,
    reference: receipt.reference,
    receivedAt: receipt.receivedAt.toISOString(),
    note: receipt.note,
    status: receipt.status,
    recordedByName: receipt.recordedBy.name,
    voidedByName: receipt.voidedBy?.name ?? null,
    voidReason: receipt.voidReason,
  }));
  const view = toAdminOrderView(order);

  return {
    ...view,
    revision: order.revision,
    additionRequests: order.additionRequests.map(toAdditionRequestView),
    paymentReceipts,
    paymentSummary: getPaymentSummary(view.totalIncludingVat, paymentReceipts),
    legalAcceptances: order.legalAcceptances.map((acceptance) => ({
      id: acceptance.id,
      documentType: acceptance.documentType,
      documentVersion: acceptance.documentVersion,
      contentHash: acceptance.contentHash,
      acceptedAt: acceptance.acceptedAt.toISOString(),
    })),
  };
}

export type AdminOrderDetailData = NonNullable<Awaited<ReturnType<typeof getAdminOrderDetail>>>;
export type AdminCustomerDetailData = NonNullable<Awaited<ReturnType<typeof getAdminCustomerDetail>>>;
export type AdminRouteDetailData = NonNullable<Awaited<ReturnType<typeof getAdminRouteDetail>>>;
