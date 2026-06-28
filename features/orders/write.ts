import type { OrderSource } from '@prisma/client';
import { calculateOrderPricing, type PricingPriceListItem, type PricingProduct, type PricingPromotion } from '../pricing/engine';
import {
  getSubmissionStatus,
  type OrderSnapshotLine,
  type OrderStatus,
  type SnapshotItem,
} from './utils';

export type OrderWriteContext = {
  customer: {
    id: string;
    routeId: string;
    priceListId: string;
    isActive: boolean;
  };
  route: {
    id: string;
    isActive: boolean;
    nextDeliveryAt: Date;
    nextCutoffAt: Date;
  };
  products: PricingProduct[];
  priceListItems: PricingPriceListItem[];
  promotions: PricingPromotion[];
};

export type SubmittedOrderPayload = {
  order: {
    customerId: string;
    routeId: string;
    status: OrderStatus;
    source: OrderSource;
    deliveryWindowStart: Date;
    deadlineAt: Date;
    submittedAt: Date;
    notes: string | null;
    internalNote: string | null;
    subtotal: number;
    discountTotal: number;
    total: number;
  };
  lines: OrderSnapshotLine[];
};

export type ManualOrderIntakeChannel = 'PHONE' | 'WHATSAPP' | 'ADMIN_MANUAL';

export function buildSubmittedOrderPayload({
  context,
  items,
  source,
  now,
  notes,
  internalNote,
}: {
  context: OrderWriteContext;
  items: SnapshotItem[];
  source: OrderSource;
  now: Date;
  notes?: string | null;
  internalNote?: string | null;
}): SubmittedOrderPayload {
  if (!context.customer.isActive) {
    throw new Error('Customer is inactive');
  }

  if (!context.route.isActive) {
    throw new Error('Route is inactive');
  }

  const pricing = calculateOrderPricing({
    customer: context.customer,
    route: context.route,
    items,
    products: context.products,
    priceListItems: context.priceListItems,
    promotions: context.promotions,
    now,
  });
  const lines = pricing.lines;

  if (lines.length === 0) {
    throw new Error('Order must include at least one product');
  }

  return {
    order: {
      customerId: context.customer.id,
      routeId: context.route.id,
      status: getSubmissionStatus({
        now,
        cutoff: context.route.nextCutoffAt,
      }),
      source,
      deliveryWindowStart: context.route.nextDeliveryAt,
      deadlineAt: context.route.nextCutoffAt,
      submittedAt: now,
      notes: normalizeNullableText(notes),
      internalNote: normalizeNullableText(internalNote),
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      total: pricing.total,
    },
    lines,
  };
}

export function formatManualOrderInternalNote({
  intakeChannel,
  note,
}: {
  intakeChannel: ManualOrderIntakeChannel;
  note?: string | null;
}): string {
  const normalizedNote = normalizeNullableText(note);
  return normalizedNote ? `[manual-order:intake=${intakeChannel}] ${normalizedNote}` : `[manual-order:intake=${intakeChannel}]`;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
