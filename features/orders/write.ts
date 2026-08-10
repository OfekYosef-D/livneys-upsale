import type { OrderSource } from '@prisma/client';
import { calculateOrderPricing, type PricingPriceListItem, type PricingProduct, type PricingPromotion } from '../pricing/engine';
import { validateInstitutionalOrderRules } from './business-rules';
import { calculatePaymentTermsSummary, type PaymentTermValue } from './payment-terms';
import {
  getSubmissionStatus,
  normalizeCustomerOrderItems,
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
    paymentTerm: PaymentTermValue;
    paymentDiscountPercent: number;
    paymentDiscountTotal: number;
    total: number;
  };
  lines: OrderSnapshotLine[];
};

export type ManualOrderIntakeChannel = 'PHONE' | 'WHATSAPP' | 'ADMIN_MANUAL';

export function buildSubmittedOrderPayload({
  context,
  items,
  source,
  paymentTerm,
  now,
  notes,
  internalNote,
}: {
  context: OrderWriteContext;
  items: SnapshotItem[];
  source: OrderSource;
  paymentTerm: PaymentTermValue;
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
    items: normalizeCustomerOrderItems(
      items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      context.products,
    ),
    products: context.products,
    priceListItems: context.priceListItems,
    promotions: context.promotions,
    now,
  });
  const lines = pricing.lines;

  if (lines.length === 0) {
    throw new Error('Order must include at least one product');
  }

  validateInstitutionalOrderRules({
    source,
    total: pricing.total,
    items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    products: context.products,
  });
  const payment = calculatePaymentTermsSummary(pricing.total, paymentTerm);

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
      paymentTerm,
      paymentDiscountPercent: payment.paymentDiscountPercent,
      paymentDiscountTotal: payment.paymentDiscountTotal,
      total: payment.total,
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
