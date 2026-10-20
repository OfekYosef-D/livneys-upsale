import type { OrderSource, OrderStatus } from '@prisma/client';
import { ValidationError } from '@/lib/errors';
import type { CatalogPricingInput } from '../catalog/customer-catalog';
import { calculateOrderPricing, type PricedLine } from '../pricing/engine';
import type { RouteSchedule } from '../routes/schedule';
import { assertMinimumOrderTotal } from './business-rules';
import { COMMERCIAL_TERMS_VERSION } from './commercial-terms';
import { normalizeOrderItems, type OrderItem } from './quantity';
import { getSubmissionStatus } from './status';
import { calculateOrderTotals, type OrderTotals, type PaymentTermValue } from './totals';

/** Everything a write needs to know about the customer, loaded once per request. */
export type OrderWriteContext = {
  customerId: string;
  routeId: string;
  schedule: RouteSchedule;
  vatRatePercent: number;
  pricing: CatalogPricingInput;
};

export type OrderRecordData = OrderTotals & {
  customerId: string;
  routeId: string;
  status: OrderStatus;
  source: OrderSource;
  deliveryWindowStart: Date;
  deadlineAt: Date;
  submittedAt: Date | null;
  notes: string | null;
  internalNote: string | null;
  paymentTerm: PaymentTermValue;
  commercialTermsVersion: string | null;
  commercialTermsAcceptedAt: Date | null;
};

/** An immutable price snapshot: later catalog changes never alter a saved order. */
export type OrderSnapshot = {
  order: OrderRecordData;
  lines: PricedLine[];
};

export type ManualOrderIntakeChannel = 'PHONE' | 'WHATSAPP' | 'ADMIN_MANUAL';

export function priceOrderItems(context: OrderWriteContext, items: readonly OrderItem[], now: Date) {
  return calculateOrderPricing({ ...context.pricing, items: normalizeOrderItems(items, context.pricing.products), now });
}

export function buildSubmittedOrder({
  context,
  items,
  source,
  paymentTerm,
  commercialTermsAccepted = false,
  notes,
  internalNote,
  now,
}: {
  context: OrderWriteContext;
  items: readonly OrderItem[];
  source: OrderSource;
  paymentTerm: PaymentTermValue;
  commercialTermsAccepted?: boolean;
  notes?: string | null;
  internalNote?: string | null;
  now: Date;
}): OrderSnapshot {
  if (source === 'CUSTOMER' && !commercialTermsAccepted) {
    throw new ValidationError('יש לאשר שההזמנה היא עסקית ואת פרטי ההזמנה לפני השליחה.');
  }

  const pricing = priceOrderItems(context, items, now);
  if (pricing.lines.length === 0) throw new ValidationError('ההזמנה חייבת לכלול לפחות מוצר אחד.');
  assertMinimumOrderTotal(source, pricing.total);

  const isCustomer = source === 'CUSTOMER';
  return {
    order: {
      ...baseRecord(context),
      ...calculateOrderTotals({ ...pricing, paymentTerm, vatRatePercent: context.vatRatePercent }),
      status: getSubmissionStatus({ now, cutoff: context.schedule.cutoffAt }),
      source,
      submittedAt: now,
      notes: normalizeText(notes),
      internalNote: normalizeText(internalNote),
      paymentTerm,
      commercialTermsVersion: isCustomer ? COMMERCIAL_TERMS_VERSION : null,
      commercialTermsAcceptedAt: isCustomer ? now : null,
    },
    lines: pricing.lines,
  };
}

/** A customer's work-in-progress cart for the current delivery; returns null when the cart is empty. */
export function buildDraftOrder({
  context,
  items,
  now,
}: {
  context: OrderWriteContext;
  items: readonly OrderItem[];
  now: Date;
}): OrderSnapshot | null {
  const pricing = priceOrderItems(context, items, now);
  if (pricing.lines.length === 0) return null;

  return {
    order: {
      ...baseRecord(context),
      ...calculateOrderTotals({ ...pricing, paymentTerm: 'NET_30', vatRatePercent: context.vatRatePercent }),
      status: 'DRAFT',
      source: 'CUSTOMER',
      submittedAt: null,
      notes: null,
      internalNote: null,
      paymentTerm: 'NET_30',
      commercialTermsVersion: null,
      commercialTermsAcceptedAt: null,
    },
    lines: pricing.lines,
  };
}

export function formatManualOrderInternalNote({ intakeChannel, note }: { intakeChannel: ManualOrderIntakeChannel; note?: string | null }): string {
  const tag = `[manual-order:intake=${intakeChannel}]`;
  const normalized = normalizeText(note);
  return normalized ? `${tag} ${normalized}` : tag;
}

function baseRecord(context: OrderWriteContext) {
  return {
    customerId: context.customerId,
    routeId: context.routeId,
    deliveryWindowStart: context.schedule.deliveryAt,
    deadlineAt: context.schedule.cutoffAt,
  };
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
