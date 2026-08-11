type AuditedOrder = {
  id: string;
  orderNumber: number | null;
  customerId: string;
  deliveryWindowStart: Date;
  status: string;
};

export type ActiveOrderDuplicateSummary = {
  duplicateGroupCount: number;
  duplicateOrderCount: number;
  groups: Array<{
    customerId: string;
    deliveryWindowStart: string;
    orders: Array<{
      id: string;
      orderNumber: number | null;
      status: string;
    }>;
  }>;
};

export function summarizeActiveOrderDuplicates(orders: AuditedOrder[]): ActiveOrderDuplicateSummary {
  const grouped = new Map<string, AuditedOrder[]>();

  for (const order of orders) {
    if (order.status === 'CANCELLED') continue;

    const key = `${order.customerId}\u0000${order.deliveryWindowStart.toISOString()}`;
    const group = grouped.get(key) ?? [];
    group.push(order);
    grouped.set(key, group);
  }

  const groups = [...grouped.values()]
    .filter((ordersForWindow) => ordersForWindow.length > 1)
    .map((ordersForWindow) => ({
      customerId: ordersForWindow[0].customerId,
      deliveryWindowStart: ordersForWindow[0].deliveryWindowStart.toISOString(),
      orders: ordersForWindow
        .map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => {
      const customerComparison = left.customerId.localeCompare(right.customerId);
      return customerComparison || left.deliveryWindowStart.localeCompare(right.deliveryWindowStart);
    });

  return {
    duplicateGroupCount: groups.length,
    duplicateOrderCount: groups.reduce((sum, group) => sum + group.orders.length, 0),
    groups,
  };
}

export function assertNoActiveOrderDuplicates(summary: ActiveOrderDuplicateSummary): void {
  if (summary.duplicateOrderCount === 0) return;

  throw new Error(
    `Found ${summary.duplicateOrderCount} non-cancelled orders across ${summary.duplicateGroupCount} duplicate delivery window(s). Resolve them explicitly before applying the order-integrity migration.`,
  );
}
