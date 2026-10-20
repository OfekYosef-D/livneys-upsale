import type { PaymentTerm } from '@prisma/client';
import { roundCurrency } from '@/lib/money';

export const paymentTermValues = ['NET_30', 'IMMEDIATE_OR_CASH'] as const satisfies readonly PaymentTerm[];
export type PaymentTermValue = (typeof paymentTermValues)[number];

export const paymentTermLabels: Record<PaymentTermValue, string> = {
  NET_30: 'שוטף 30',
  IMMEDIATE_OR_CASH: 'תשלום מיידי / מזומן',
};

export const IMMEDIATE_PAYMENT_DISCOUNT_PERCENT = 5;

/** Fallback only; the authoritative rate comes from the TaxRate table at order time. */
export const STANDARD_VAT_RATE_PERCENT = 18;

/** Every monetary snapshot persisted on an order or an addition request. */
export type OrderTotals = {
  subtotal: number;
  discountTotal: number;
  paymentDiscountPercent: number;
  paymentDiscountTotal: number;
  total: number;
  vatRatePercent: number;
  vatTotal: number;
  totalIncludingVat: number;
};

export function calculatePaymentDiscount(amountAfterPromotions: number, paymentTerm: PaymentTermValue) {
  const paymentDiscountPercent = paymentTerm === 'IMMEDIATE_OR_CASH' ? IMMEDIATE_PAYMENT_DISCOUNT_PERCENT : 0;
  const paymentDiscountTotal = roundCurrency(amountAfterPromotions * (paymentDiscountPercent / 100));
  return {
    paymentDiscountPercent,
    paymentDiscountTotal,
    total: roundCurrency(amountAfterPromotions - paymentDiscountTotal),
  };
}

export function calculateVat(netTotal: number, vatRatePercent = STANDARD_VAT_RATE_PERCENT) {
  const vatTotal = roundCurrency(netTotal * (vatRatePercent / 100));
  return { vatRatePercent, vatTotal, totalIncludingVat: roundCurrency(netTotal + vatTotal) };
}

/** Promotions → payment-term discount → VAT, in that order (as agreed with the owner). */
export function calculateOrderTotals({
  subtotal,
  discountTotal,
  paymentTerm,
  vatRatePercent,
}: {
  subtotal: number;
  discountTotal: number;
  paymentTerm: PaymentTermValue;
  vatRatePercent: number;
}): OrderTotals {
  const payment = calculatePaymentDiscount(roundCurrency(subtotal - discountTotal), paymentTerm);
  const vat = calculateVat(payment.total, vatRatePercent);
  return {
    subtotal: roundCurrency(subtotal),
    discountTotal: roundCurrency(discountTotal),
    paymentDiscountPercent: payment.paymentDiscountPercent,
    paymentDiscountTotal: payment.paymentDiscountTotal,
    total: payment.total,
    ...vat,
  };
}

type DecimalLike = { toString(): string } | number | string | null | undefined;

/** Reads persisted Decimal columns into plain numbers for the UI. */
export function toOrderTotals(record: Record<keyof OrderTotals, DecimalLike>): OrderTotals {
  return {
    subtotal: Number(record.subtotal ?? 0),
    discountTotal: Number(record.discountTotal ?? 0),
    paymentDiscountPercent: Number(record.paymentDiscountPercent ?? 0),
    paymentDiscountTotal: Number(record.paymentDiscountTotal ?? 0),
    total: Number(record.total ?? 0),
    vatRatePercent: Number(record.vatRatePercent ?? STANDARD_VAT_RATE_PERCENT),
    vatTotal: Number(record.vatTotal ?? 0),
    totalIncludingVat: Number(record.totalIncludingVat ?? 0),
  };
}
