import type { OrderSource, OrderStatus } from '@prisma/client';
import type { PaymentTermValue } from '@/features/orders/payment-terms';
import { activeOrderStatuses } from '@/features/orders/utils';
import { prisma } from '@/lib/db';
import type { AdminDashboardOrder, AdminOrderLine, AdminOrderSummary, AdminRouteSummary } from './types';

const activeStatuses = activeOrderStatuses as OrderStatus[];

export async function getAdminDashboardData() {
  const [orders, routes, reminderJobs] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: {
          in: activeStatuses,
        },
        customer: {
          users: {
            none: { email: { endsWith: '@livneys.local', mode: 'insensitive' } },
          },
        },
      },
      include: {
        customer: true,
        route: true,
        lines: true,
        notificationJobs: {
          orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: {
            id: true,
            status: true,
            templateKey: true,
            scheduledAt: true,
            processedAt: true,
            errorMessage: true,
          },
        },
      },
      orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
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
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.reminderJob.findMany({
      where: {
        customer: {
          users: {
            none: { email: { endsWith: '@livneys.local', mode: 'insensitive' } },
          },
        },
      },
      include: {
        customer: true,
        route: true,
      },
      orderBy: { scheduledAt: 'desc' },
      take: 10,
    }),
  ]);

  const orderSummaries = orders.map(mapDashboardOrder);
  const routeSummaries: AdminRouteSummary[] = routes.map((route) => {
    const orderedCount = route.customers.filter((customer) => customer.orders.length > 0).length;
    const missingCustomers = route.customers
      .filter((customer) => customer.orders.length === 0)
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        contact: customer.contact,
        phone: customer.phone,
      }));

    return {
      id: route.id,
      name: route.name,
      nextDeliveryAt: route.nextDeliveryAt.toISOString(),
      nextCutoffAt: route.nextCutoffAt.toISOString(),
      customerCount: route.customers.length,
      orderedCount,
      missingCount: route.customers.length - orderedCount,
      missingCustomers,
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
      users: {
        select: { id: true, name: true, email: true, isActive: true, passwordHash: true },
        orderBy: { createdAt: 'asc' },
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
    users: customer.users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      setupComplete: Boolean(user.passwordHash),
    })),
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
      additionRequests: {
        include: { lines: true, reviewedBy: { select: { name: true } } },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      },
    },
  });

  if (!order) return null;

  return {
    ...mapOrderSummary(order),
    revision: order.revision,
    notes: order.notes,
    internalNote: order.internalNote,
    customerContact: order.customer.contact,
    customerPhone: order.customer.phone,
    lines: order.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      listUnitPrice: Number(line.listUnitPrice),
      unitPrice: Number(line.unitPrice),
      lineSubtotal: Number(line.lineSubtotal),
      discountTotal: Number(line.discountTotal),
      lineTotal: Number(line.lineTotal),
      promotionLabel: getPromotionLabel(line.promotionSnapshot),
    })),
    additionRequests: order.additionRequests.map((request) => ({
      id: request.id,
      status: request.status,
      rejectionReason: request.rejectionReason,
      submittedAt: request.submittedAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      reviewedByName: request.reviewedBy?.name ?? null,
      subtotal: Number(request.subtotal),
      discountTotal: Number(request.discountTotal),
      paymentDiscountPercent: Number(request.paymentDiscountPercent),
      paymentDiscountTotal: Number(request.paymentDiscountTotal),
      total: Number(request.total),
      vatRatePercent: Number(request.vatRatePercent),
      vatTotal: Number(request.vatTotal),
      totalIncludingVat: Number(request.totalIncludingVat),
      lines: request.lines.map((line) => ({
        id: line.id,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice),
        lineTotal: Number(line.lineTotal),
      })),
    })),
  };
}

function mapOrderSummary(order: {
  id: string;
  orderNumber: number;
  customerId: string;
  status: OrderStatus;
  source: OrderSource;
  submittedAt: Date | null;
  deliveryWindowStart: Date;
  subtotal: unknown;
  discountTotal: unknown;
  paymentTerm: PaymentTermValue;
  paymentDiscountPercent: unknown;
  paymentDiscountTotal: unknown;
  total: unknown;
  vatRatePercent: unknown;
  vatTotal: unknown;
  totalIncludingVat: unknown;
  commercialTermsVersion: string | null;
  commercialTermsAcceptedAt: Date | null;
  customer: { id: string; name: string };
  route: { id: string; name: string } | null;
  lines: { quantity: number; lineTotal: unknown }[];
}): AdminOrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
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
    paymentTerm: order.paymentTerm,
    paymentDiscountPercent: Number(order.paymentDiscountPercent),
    paymentDiscountTotal: Number(order.paymentDiscountTotal),
    total: Number(order.total),
    vatRatePercent: Number(order.vatRatePercent),
    vatTotal: Number(order.vatTotal),
    totalIncludingVat: Number(order.totalIncludingVat),
    commercialTermsVersion: order.commercialTermsVersion,
    commercialTermsAcceptedAt: order.commercialTermsAcceptedAt?.toISOString() ?? null,
    lineCount: order.lines.length,
    hasUpsell: order.lines.length >= 3,
  };
}

function mapDashboardOrder(order: {
  id: string;
  orderNumber: number;
  customerId: string;
  status: OrderStatus;
  source: OrderSource;
  submittedAt: Date | null;
  deliveryWindowStart: Date;
  notes: string | null;
  internalNote: string | null;
  subtotal: unknown;
  discountTotal: unknown;
  paymentTerm: PaymentTermValue;
  paymentDiscountPercent: unknown;
  paymentDiscountTotal: unknown;
  total: unknown;
  vatRatePercent: unknown;
  vatTotal: unknown;
  totalIncludingVat: unknown;
  commercialTermsVersion: string | null;
  commercialTermsAcceptedAt: Date | null;
  customer: { id: string; name: string; contact: string; phone: string };
  route: { id: string; name: string } | null;
  lines: Array<{
    id: string;
    productName: string;
    quantity: number;
    listUnitPrice: unknown;
    unitPrice: unknown;
    lineSubtotal: unknown;
    discountTotal: unknown;
    lineTotal: unknown;
    promotionSnapshot: unknown;
  }>;
  notificationJobs: Array<{
    id: string;
    status: string;
    templateKey: string;
    scheduledAt: Date;
    processedAt: Date | null;
    errorMessage: string | null;
  }>;
}): AdminDashboardOrder {
  const latestNotification = order.notificationJobs[0] ?? null;

  return {
    ...mapOrderSummary(order),
    customerContact: order.customer.contact,
    customerPhone: order.customer.phone,
    notes: order.notes,
    internalNote: order.internalNote,
    lines: order.lines.map(mapOrderLine),
    latestNotification: latestNotification
      ? {
          id: latestNotification.id,
          status: latestNotification.status,
          templateKey: latestNotification.templateKey,
          scheduledAt: latestNotification.scheduledAt.toISOString(),
          processedAt: latestNotification.processedAt?.toISOString() ?? null,
          errorMessage: latestNotification.errorMessage,
        }
      : null,
  };
}

function mapOrderLine(line: {
  id: string;
  productName: string;
  quantity: number;
  listUnitPrice: unknown;
  unitPrice: unknown;
  lineSubtotal: unknown;
  discountTotal: unknown;
  lineTotal: unknown;
  promotionSnapshot: unknown;
}): AdminOrderLine {
  return {
    id: line.id,
    productName: line.productName,
    quantity: line.quantity,
    listUnitPrice: Number(line.listUnitPrice),
    unitPrice: Number(line.unitPrice),
    lineSubtotal: Number(line.lineSubtotal),
    discountTotal: Number(line.discountTotal),
    lineTotal: Number(line.lineTotal),
    promotionLabel: getPromotionLabel(line.promotionSnapshot),
  };
}

function getPromotionLabel(snapshot: unknown): string | undefined {
  if (!snapshot || typeof snapshot !== 'object' || !('tag' in snapshot)) {
    return undefined;
  }

  const tag = (snapshot as { tag?: unknown }).tag;
  return typeof tag === 'string' && tag.trim().length > 0 ? tag : undefined;
}
