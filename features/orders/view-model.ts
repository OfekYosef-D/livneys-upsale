import type { OrderLine, OrderSource, OrderStatus, Prisma } from '@prisma/client';
import { toOrderTotals, type OrderTotals, type PaymentTermValue } from './totals';

/** Serializable shapes passed from server components to client components. */
export type OrderLineView = {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  listUnitPrice: number;
  unitPrice: number;
  lineSubtotal: number;
  discountTotal: number;
  lineTotal: number;
  promotionLabel?: string;
};

export type OrderView = OrderTotals & {
  id: string;
  orderNumber: number;
  customerId: string;
  routeId: string | null;
  status: OrderStatus;
  source: OrderSource;
  paymentTerm: PaymentTermValue;
  deliveryWindowStart: string;
  submittedAt: string | null;
  notes: string | null;
  commercialTermsVersion: string | null;
  commercialTermsAcceptedAt: string | null;
  lines: OrderLineView[];
};

export const orderWithLinesInclude = {
  lines: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

type OrderWithLines = Prisma.OrderGetPayload<{ include: typeof orderWithLinesInclude }>;

type LineRecord = Pick<
  OrderLine,
  'id' | 'productId' | 'productName' | 'quantity' | 'listUnitPrice' | 'unitPrice' | 'lineSubtotal' | 'discountTotal' | 'lineTotal' | 'promotionSnapshot'
>;

export function toOrderLineView(line: LineRecord): OrderLineView {
  return {
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
  };
}

export function toOrderView(order: OrderWithLines): OrderView {
  return {
    ...toOrderTotals(order),
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    routeId: order.routeId,
    status: order.status,
    source: order.source,
    paymentTerm: order.paymentTerm,
    deliveryWindowStart: order.deliveryWindowStart.toISOString(),
    submittedAt: order.submittedAt?.toISOString() ?? null,
    notes: order.notes,
    commercialTermsVersion: order.commercialTermsVersion,
    commercialTermsAcceptedAt: order.commercialTermsAcceptedAt?.toISOString() ?? null,
    lines: order.lines.map(toOrderLineView),
  };
}

function getPromotionLabel(snapshot: Prisma.JsonValue | null): string | undefined {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return undefined;
  const tag = (snapshot as { tag?: unknown }).tag;
  return typeof tag === 'string' && tag.trim() ? tag : undefined;
}
