import type { OrderSource, OrderStatus } from '@prisma/client';
import { activeOrderStatuses } from '@/features/orders/utils';
import { prisma } from '@/lib/db';
import type { AdminOrderSummary, AdminRouteSummary } from './types';

const activeStatuses = activeOrderStatuses as OrderStatus[];

export async function getAdminDashboardData() {
  const [orders, routes, reminderJobs] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: {
          in: activeStatuses,
        },
      },
      include: {
        customer: true,
        route: true,
        lines: true,
      },
      orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 25,
    }),
    prisma.route.findMany({
      where: { isActive: true },
      include: {
        customers: {
          where: { isActive: true },
          include: {
            orders: {
              where: {
                status: {
                  in: activeStatuses,
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.reminderJob.findMany({
      include: {
        customer: true,
        route: true,
      },
      orderBy: { scheduledAt: 'desc' },
      take: 10,
    }),
  ]);

  const orderSummaries = orders.map(mapOrderSummary);
  const routeSummaries: AdminRouteSummary[] = routes.map((route) => {
    const orderedCount = route.customers.filter((customer) => customer.orders.length > 0).length;

    return {
      id: route.id,
      name: route.name,
      nextDeliveryAt: route.nextDeliveryAt.toISOString(),
      nextCutoffAt: route.nextCutoffAt.toISOString(),
      customerCount: route.customers.length,
      orderedCount,
      missingCount: route.customers.length - orderedCount,
    };
  });

  return {
    orders: orderSummaries,
    routes: routeSummaries,
    reminderJobs: reminderJobs.map((job) => ({
      id: job.id,
      customerName: job.customer.name,
      routeName: job.route.name,
      channel: job.channel,
      status: job.status,
      scheduledAt: job.scheduledAt.toISOString(),
      errorMessage: job.errorMessage,
    })),
    kpis: {
      openOrders: orderSummaries.length,
      needsApproval: orderSummaries.filter((order) => order.status === 'SUBMITTED' || order.status === 'SPECIAL_REQUEST').length,
      readyForRoute: orderSummaries.filter((order) => order.status === 'APPROVED' || order.status === 'PACKED').length,
      missingOrders: routeSummaries.reduce((sum, route) => sum + route.missingCount, 0),
    },
  };
}

export async function getAdminRouteDetail(routeId: string) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: {
      customers: {
        where: { isActive: true },
        include: {
          orders: {
            include: { lines: true, route: true, customer: true },
            orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!route) return null;

  return {
    id: route.id,
    name: route.name,
    driver: route.driver,
    nextDeliveryAt: route.nextDeliveryAt.toISOString(),
    nextCutoffAt: route.nextCutoffAt.toISOString(),
    customers: route.customers.map((customer) => {
      const latestOrder = customer.orders.find((order) => activeStatuses.includes(order.status));
      return {
        id: customer.id,
        name: customer.name,
        contact: customer.contact,
        phone: customer.phone,
        latestOrder: latestOrder ? mapOrderSummary(latestOrder) : null,
      };
    }),
  };
}

export async function getAdminCustomerDetail(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      route: true,
      orders: {
        include: {
          lines: true,
          route: true,
          customer: true,
        },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      },
      recommendations: {
        where: { isActive: true },
        include: { product: true },
        take: 8,
      },
    },
  });

  if (!customer) return null;

  return {
    id: customer.id,
    name: customer.name,
    contact: customer.contact,
    phone: customer.phone,
    region: customer.region,
    address: customer.address,
    notes: customer.notes,
    routeName: customer.route.name,
    routeId: customer.route.id,
    orders: customer.orders.map(mapOrderSummary),
    recommendations: customer.recommendations.map((recommendation) => ({
      productName: recommendation.product.name,
      reason: recommendation.reason,
    })),
  };
}

export async function getAdminOrderDetail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      route: true,
      lines: true,
    },
  });

  if (!order) return null;

  return {
    ...mapOrderSummary(order),
    notes: order.notes,
    internalNote: order.internalNote,
    customerContact: order.customer.contact,
    customerPhone: order.customer.phone,
    lines: order.lines.map((line) => ({
      id: line.id,
      productName: line.productName,
      quantity: line.quantity,
      listUnitPrice: Number(line.listUnitPrice),
      unitPrice: Number(line.unitPrice),
      lineSubtotal: Number(line.lineSubtotal),
      discountTotal: Number(line.discountTotal),
      lineTotal: Number(line.lineTotal),
      promotionLabel: getPromotionLabel(line.promotionSnapshot),
    })),
  };
}

function mapOrderSummary(order: {
  id: string;
  customerId: string;
  status: OrderStatus;
  source: OrderSource;
  submittedAt: Date | null;
  deliveryWindowStart: Date;
  subtotal: unknown;
  discountTotal: unknown;
  total: unknown;
  customer: { id: string; name: string };
  route: { id: string; name: string } | null;
  lines: { quantity: number; lineTotal: unknown }[];
}): AdminOrderSummary {
  return {
    id: order.id,
    customerId: order.customerId,
    customerName: order.customer.name,
    routeId: order.route?.id ?? null,
    routeName: order.route?.name ?? 'ללא קו',
    status: order.status,
    source: order.source,
    submittedAt: order.submittedAt?.toISOString() ?? null,
    deliveryWindowStart: order.deliveryWindowStart.toISOString(),
    subtotal: Number(order.subtotal),
    discountTotal: Number(order.discountTotal),
    total: Number(order.total),
    lineCount: order.lines.length,
    hasUpsell: order.lines.length >= 3,
  };
}

function getPromotionLabel(snapshot: unknown): string | undefined {
  if (!snapshot || typeof snapshot !== 'object' || !('tag' in snapshot)) {
    return undefined;
  }

  const tag = (snapshot as { tag?: unknown }).tag;
  return typeof tag === 'string' && tag.trim().length > 0 ? tag : undefined;
}
