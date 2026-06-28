import type { OrderStatus } from '@prisma/client';
import type { PortalOrder } from './types';

type PortalOrderLineSnapshot = {
  productId: string | null;
  productName: string;
  quantity: number;
  listUnitPrice?: unknown;
  unitPrice: unknown;
  lineSubtotal?: unknown;
  discountTotal?: unknown;
  lineTotal: unknown;
  promotionId?: string | null;
  promotionSnapshot?: unknown;
};

type PortalOrderSnapshot = {
  id: string;
  customerId: string;
  submittedAt: Date | null;
  createdAt: Date;
  status: OrderStatus;
  subtotal?: unknown;
  discountTotal?: unknown;
  total: unknown;
  lines: PortalOrderLineSnapshot[];
};

export function mapPortalOrder(order: PortalOrderSnapshot | null, customerId: string): PortalOrder {
  if (!order) {
    return {
      id: 'empty',
      customerId,
      date: new Date().toISOString(),
      status: 'DRAFT',
      subtotal: 0,
      discountTotal: 0,
      total: 0,
      items: [],
    };
  }

  return {
    id: order.id,
    customerId: order.customerId,
    date: (order.submittedAt ?? order.createdAt).toISOString(),
    status: order.status,
    subtotal: Number(order.subtotal ?? order.total),
    discountTotal: Number(order.discountTotal ?? 0),
    total: Number(order.total),
    items: order.lines
      .filter((line) => line.productId)
      .map((line) => ({
        productId: line.productId ?? '',
        productName: line.productName,
        qty: line.quantity,
        listUnitPrice: Number(line.listUnitPrice ?? line.unitPrice),
        unitPrice: Number(line.unitPrice),
        lineSubtotal: Number(line.lineSubtotal ?? line.lineTotal),
        discountTotal: Number(line.discountTotal ?? 0),
        lineTotal: Number(line.lineTotal),
        promotionLabel: getPromotionLabel(line.promotionSnapshot),
      })),
  };
}

function getPromotionLabel(snapshot: unknown): string | undefined {
  if (!snapshot || typeof snapshot !== 'object' || !('tag' in snapshot)) {
    return undefined;
  }

  const tag = (snapshot as { tag?: unknown }).tag;
  return typeof tag === 'string' && tag.trim().length > 0 ? tag : undefined;
}
