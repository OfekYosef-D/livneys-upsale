import type { OrderWriteContext } from '../orders/write';
import { calculatePaymentTermsSummary, type PaymentTermValue } from '../orders/payment-terms';
import { calculateVatSummary } from '../orders/vat';
import { normalizeCustomerOrderItems, type OrderSnapshotLine } from '../orders/utils';
import { calculateOrderPricing } from '../pricing/engine';

export type OrderAdditionSnapshot = {
  subtotal: number;
  discountTotal: number;
  paymentDiscountPercent: number;
  paymentDiscountTotal: number;
  total: number;
  vatRatePercent: number;
  vatTotal: number;
  totalIncludingVat: number;
  lines: OrderSnapshotLine[];
};

export function buildOrderAdditionSnapshot({
  context,
  items,
  paymentTerm,
  now,
}: {
  context: OrderWriteContext;
  items: Array<{ productId: string; quantity: number }>;
  paymentTerm: PaymentTermValue;
  now: Date;
}): OrderAdditionSnapshot {
  const normalizedItems = normalizeCustomerOrderItems(items, context.products);
  const pricing = calculateOrderPricing({
    customer: context.customer,
    route: context.route,
    products: context.products,
    priceListItems: context.priceListItems,
    promotions: context.promotions,
    items: normalizedItems,
    now,
  });

  if (pricing.lines.length === 0) {
    throw new Error('בקשת תוספת חייבת לכלול לפחות מוצר אחד.');
  }

  const payment = calculatePaymentTermsSummary(pricing.total, paymentTerm);
  const vat = calculateVatSummary(payment.total);

  return {
    subtotal: pricing.subtotal,
    discountTotal: pricing.discountTotal,
    paymentDiscountPercent: payment.paymentDiscountPercent,
    paymentDiscountTotal: payment.paymentDiscountTotal,
    total: payment.total,
    vatRatePercent: vat.vatRatePercent,
    vatTotal: vat.vatTotal,
    totalIncludingVat: vat.totalIncludingVat,
    lines: pricing.lines,
  };
}
