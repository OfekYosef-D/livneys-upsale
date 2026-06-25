export type CrmOrderStatus = 'new' | 'needs_review' | 'approved' | 'packed' | 'completed';

export type CrmDemoState = {
  orderStatuses?: Record<string, CrmOrderStatus>;
  contactedCustomers?: Record<string, boolean>;
  dismissedOpportunityIds?: string[];
  internalNotes?: Record<string, string>;
};

type ProductLike = {
  id: string;
  name: string;
  price: number;
  minQty?: number;
};

type CustomerLike = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  region: string;
  routeId: string;
  status: string;
  address: string;
  notes: string;
};

type RouteLike = {
  id: string;
  name: string;
  nextDelivery: string;
  deadline: string;
  driver: string;
  customerIds: string[];
};

type OrderLike = {
  id: string;
  customerId: string;
  date: string;
  status: string;
  items: { productId: string; qty: number }[];
};

type PromotionLike = {
  id: string;
  title: string;
  tag: string;
  description: string;
  productId: string;
};

export type CrmOrder = {
  id: string;
  customerId: string;
  customerName: string;
  contact: string;
  routeId: string;
  routeName: string;
  deadline: string;
  date: string;
  status: CrmOrderStatus;
  statusLabel: string;
  nextAction: string;
  total: number;
  items: OrderLike['items'];
};

export type CrmCustomerSignal = {
  id: string;
  customerId: string;
  customerName: string;
  contact: string;
  phone: string;
  kind: 'opened_no_order' | 'needs_contact';
  reason: string;
  suggestedAction: string;
  isDone: boolean;
};

export type CrmOpportunity = {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  promotionTitle: string;
  rationale: string;
  potentialValue: number;
};

export type CrmRouteReadiness = {
  routeId: string;
  routeName: string;
  totalCustomers: number;
  readyCount: number;
  actionRequiredCount: number;
  missingOrderCount: number;
  readinessPercent: number;
};

export type CrmKpis = {
  openOrders: number;
  needsApproval: number;
  readyForRoute: number;
  followUps: number;
  opportunities: number;
};

export const statusLabels: Record<CrmOrderStatus, string> = {
  new: 'חדש',
  needs_review: 'צריך אישור',
  approved: 'מאושר',
  packed: 'ארוז',
  completed: 'הושלם',
};

export const statusActions: Record<CrmOrderStatus, string> = {
  new: 'בדיקת הזמנה',
  needs_review: 'לאישור',
  approved: 'לאריזה',
  packed: 'לחלוקה',
  completed: 'הושלם',
};

export function buildCrmOrders({
  orders,
  customers,
  routes,
  products,
  state = {},
}: {
  orders: OrderLike[];
  customers: CustomerLike[];
  routes: RouteLike[];
  products: ProductLike[];
  state?: CrmDemoState;
}): CrmOrder[] {
  return orders.map((order) => {
    const customer = customers.find((item) => item.id === order.customerId) ?? customers[0];
    const route = routes.find((item) => item.id === customer.routeId) ?? routes[0];
    const status = state.orderStatuses?.[order.id] ?? normalizeOrderStatus(order.status, order.id);
    const total = order.items.reduce((sum, item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return sum + (product ? product.price * item.qty : 0);
    }, 0);

    return {
      id: order.id,
      customerId: customer.id,
      customerName: customer.name,
      contact: customer.contact,
      routeId: route.id,
      routeName: route.name,
      deadline: route.deadline,
      date: order.date,
      status,
      statusLabel: statusLabels[status],
      nextAction: statusActions[status],
      total,
      items: order.items,
    };
  });
}

export function getCrmKpis({
  crmOrders,
  signals,
  opportunities,
  readiness,
}: {
  crmOrders: CrmOrder[];
  signals: CrmCustomerSignal[];
  opportunities: CrmOpportunity[];
  readiness: CrmRouteReadiness[];
}): CrmKpis {
  return {
    openOrders: crmOrders.filter((order) => order.status !== 'completed').length,
    needsApproval: crmOrders.filter((order) => order.status === 'new' || order.status === 'needs_review').length,
    readyForRoute: readiness.reduce((sum, route) => sum + route.readyCount, 0),
    followUps: signals.filter((signal) => !signal.isDone).length,
    opportunities: opportunities.length,
  };
}

export function getCustomerSignals({
  customers,
  orders,
  state = {},
}: {
  customers: CustomerLike[];
  orders: OrderLike[];
  state?: CrmDemoState;
}): CrmCustomerSignal[] {
  return customers.flatMap((customer) => {
    const signals: CrmCustomerSignal[] = [];
    const hasOrders = orders.some((order) => order.customerId === customer.id);
    const wasContacted = Boolean(state.contactedCustomers?.[customer.id]);

    if (customer.status.includes('פתח') || (!hasOrders && !customer.status.includes('הזמין'))) {
      signals.push({
        id: `${customer.id}-opened`,
        customerId: customer.id,
        customerName: customer.name,
        contact: customer.contact,
        phone: customer.phone,
        kind: 'opened_no_order',
        reason: 'פתח קישור ועדיין לא סיים הזמנה',
        suggestedAction: 'שליחת תזכורת',
        isDone: wasContacted,
      });
    }

    if (customer.status.includes('מעקב')) {
      signals.push({
        id: `${customer.id}-contact`,
        customerId: customer.id,
        customerName: customer.name,
        contact: customer.contact,
        phone: customer.phone,
        kind: 'needs_contact',
        reason: customer.notes,
        suggestedAction: 'שיחת וואטסאפ',
        isDone: wasContacted,
      });
    }

    return signals;
  });
}

export function getRouteReadiness({
  routes,
  customers,
  crmOrders,
}: {
  routes: RouteLike[];
  customers: CustomerLike[];
  crmOrders: CrmOrder[];
}): CrmRouteReadiness[] {
  return routes.map((route) => {
    const routeCustomers = customers.filter((customer) => route.customerIds.includes(customer.id));
    const buckets = routeCustomers.reduce(
      (accumulator, customer) => {
        const latestOrder = getLatestOrderForCustomer(crmOrders, customer.id);

        if (!latestOrder || latestOrder.status === 'completed') {
          accumulator.missingOrderCount += 1;
          return accumulator;
        }

        if (latestOrder.status === 'approved' || latestOrder.status === 'packed') {
          accumulator.readyCount += 1;
          return accumulator;
        }

        accumulator.actionRequiredCount += 1;
        return accumulator;
      },
      { readyCount: 0, actionRequiredCount: 0, missingOrderCount: 0 },
    );

    return {
      routeId: route.id,
      routeName: route.name,
      totalCustomers: routeCustomers.length,
      ...buckets,
      readinessPercent: routeCustomers.length > 0 ? Math.round((buckets.readyCount / routeCustomers.length) * 100) : 0,
    };
  });
}

export function getSalesOpportunities({
  customers,
  orders,
  products,
  promotions,
  state = {},
}: {
  customers: CustomerLike[];
  orders: OrderLike[];
  products: ProductLike[];
  promotions: PromotionLike[];
  state?: CrmDemoState;
}): CrmOpportunity[] {
  const dismissed = new Set(state.dismissedOpportunityIds ?? []);

  return promotions.flatMap((promotion) => {
    const product = products.find((item) => item.id === promotion.productId);
    if (!product) {
      return [];
    }

    const customer = customers.find((candidate) => {
      const opportunityId = `${candidate.id}-${product.id}`;
      return !dismissed.has(opportunityId) && !customerOrderedProduct(orders, candidate.id, product.id);
    });

    if (!customer) {
      return [];
    }

    return [
      {
        id: `${customer.id}-${product.id}`,
        customerId: customer.id,
        customerName: customer.name,
        productId: product.id,
        productName: product.name,
        promotionTitle: promotion.title,
        rationale: promotion.description,
        potentialValue: product.price * (product.minQty ?? 1),
      },
    ];
  });
}

function getLatestOrderForCustomer(crmOrders: CrmOrder[], customerId: string): CrmOrder | undefined {
  return crmOrders
    .filter((order) => order.customerId === customerId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

function customerOrderedProduct(orders: OrderLike[], customerId: string, productId: string): boolean {
  return orders.some((order) => order.customerId === customerId && order.items.some((item) => item.productId === productId));
}

function normalizeOrderStatus(status: string, orderId: string): CrmOrderStatus {
  const normalized = status.toLowerCase();

  if (normalized.includes('approved') || normalized.includes('מאושר')) return 'approved';
  if (normalized.includes('packed') || normalized.includes('ארוז')) return 'packed';
  if (normalized.includes('completed') || normalized.includes('סופק') || normalized.includes('הושלם')) return 'completed';
  if (normalized.includes('draft') || normalized.includes('טיוט')) return 'new';
  if (normalized.includes('new') || normalized.includes('חדש')) return 'new';
  if (normalized.includes('review') || normalized.includes('התקבל') || normalized.includes('אישור')) return 'needs_review';

  if (orderId.endsWith('1001') || orderId.endsWith('1003')) return 'completed';
  if (orderId.endsWith('1004')) return 'new';
  return 'needs_review';
}
