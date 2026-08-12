import type { OrderSource } from '@prisma/client';
import { SafeActionError } from '../../lib/safe-action-error';
import { calculateOrderPricing, type PricingPriceListItem, type PricingProduct, type PricingPromotion } from '../pricing/engine';
import { validateInstitutionalOrderRules } from './business-rules';
import { COMMERCIAL_TERMS_VERSION } from './commercial-terms';
import { calculatePaymentTermsSummary, type PaymentTermValue } from './payment-terms';
import { calculateVatSummary } from './vat';
import {
  getSubmissionStatus,
  normalizeCustomerOrderItems,
  type OrderSnapshotLine,
  type OrderStatus,
  type SnapshotItem,
} from './utils';

export type OrderWriteContext = {
  vatRatePercent?: number;
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
    vatRatePercent: number;
    vatTotal: number;
    totalIncludingVat: number;
    commercialTermsVersion: string | null;
    commercialTermsAcceptedAt: Date | null;
  };
  lines: OrderSnapshotLine[];
};

export type ManualOrderIntakeChannel = 'PHONE' | 'WHATSAPP' | 'ADMIN_MANUAL';

export function buildSubmittedOrderPayload({
  context,
  items,
  source,
  paymentTerm,
  commercialTermsAccepted = false,
  now,
  notes,
  internalNote,
}: {
  context: OrderWriteContext;
  items: SnapshotItem[];
  source: OrderSource;
  paymentTerm: PaymentTermValue;
  commercialTermsAccepted?: boolean;
  now: Date;
  notes?: string | null;
  internalNote?: string | null;
}): SubmittedOrderPayload {
  if (source === 'CUSTOMER' && !commercialTermsAccepted) {
    throw new SafeActionError('VALIDATION_ERROR', 'יש לאשר שההזמנה היא עסקית ואת פרטי ההזמנה לפני השליחה.');
  }

  if (!context.customer.isActive) {
    throw new SafeActionError('ORDER_LOCKED', 'הלקוח אינו פעיל.');
  }

  if (!context.route.isActive) {
    throw new SafeActionError('ORDER_LOCKED', 'קו החלוקה של הלקוח אינו פעיל.');
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
    throw new SafeActionError('VALIDATION_ERROR', 'ההזמנה חייבת לכלול לפחות מוצר אחד.');
  }

  validateInstitutionalOrderRules({
    source,
    total: pricing.total,
    items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    products: context.products,
  });
  const payment = calculatePaymentTermsSummary(pricing.total, paymentTerm);
  const vat = calculateVatSummary(payment.total, context.vatRatePercent);

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
      vatRatePercent: vat.vatRatePercent,
      vatTotal: vat.vatTotal,
      totalIncludingVat: vat.totalIncludingVat,
      commercialTermsVersion: source === 'CUSTOMER' ? COMMERCIAL_TERMS_VERSION : null,
      commercialTermsAcceptedAt: source === 'CUSTOMER' ? now : null,
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
