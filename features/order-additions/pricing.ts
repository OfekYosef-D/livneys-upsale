import type { OrderWriteContext } from '../orders/write';
import { SafeActionError } from '../../lib/safe-action-error';
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
  existingItems = [],
  items,
  paymentTerm,
  now,
}: {
  context: OrderWriteContext;
  existingItems?: Array<{ productId: string; quantity: number }>;
  items: Array<{ productId: string; quantity: number }>;
  paymentTerm: PaymentTermValue;
  now: Date;
}): OrderAdditionSnapshot {
  const normalizedItems = normalizeCustomerOrderItems(items, context.products);
  const existingQuantities = existingItems.reduce((quantities, item) => {
    if (item.quantity > 0) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    return quantities;
  }, new Map<string, number>());
  const pricingInput = {
    customer: context.customer,
    route: context.route,
    products: context.products,
    priceListItems: context.priceListItems,
    promotions: context.promotions,
    now,
  };
  const combinedPricing = calculateOrderPricing({
    ...pricingInput,
    items: normalizedItems.map((item) => ({
      ...item,
      quantity: item.quantity + (existingQuantities.get(item.productId) ?? 0),
    })),
  });
  const baselinePricing = calculateOrderPricing({
    ...pricingInput,
    items: normalizedItems.flatMap((item) => {
      const quantity = existingQuantities.get(item.productId) ?? 0;
      return quantity > 0 ? [{ productId: item.productId, quantity }] : [];
    }),
  });
  const baselineByProductId = new Map(baselinePricing.lines.map((line) => [line.productId, line]));
  const additionQuantityByProductId = new Map(normalizedItems.map((item) => [item.productId, item.quantity]));
  const lines = combinedPricing.lines.map((combinedLine) => {
    const quantity = additionQuantityByProductId.get(combinedLine.productId) ?? 0;
    const lineSubtotal = roundCurrency(combinedLine.listUnitPrice * quantity);
    const baselineDiscount = baselineByProductId.get(combinedLine.productId)?.discountTotal ?? 0;
    const discountTotal = Math.min(lineSubtotal, Math.max(0, roundCurrency(combinedLine.discountTotal - baselineDiscount)));

    return {
      ...combinedLine,
      quantity,
      lineSubtotal,
      discountTotal,
      lineTotal: roundCurrency(lineSubtotal - discountTotal),
      promotionId: discountTotal > 0 ? combinedLine.promotionId : null,
      promotionSnapshot: discountTotal > 0 ? combinedLine.promotionSnapshot : null,
    };
  });
  const pricing = {
    lines,
    subtotal: roundCurrency(lines.reduce((sum, line) => sum + line.lineSubtotal, 0)),
    discountTotal: roundCurrency(lines.reduce((sum, line) => sum + line.discountTotal, 0)),
    total: roundCurrency(lines.reduce((sum, line) => sum + line.lineTotal, 0)),
  };

  if (pricing.lines.length === 0) {
    throw new SafeActionError('VALIDATION_ERROR', 'בקשת תוספת חייבת לכלול לפחות מוצר אחד.');
  }

  const payment = calculatePaymentTermsSummary(pricing.total, paymentTerm);
  const vat = calculateVatSummary(payment.total, context.vatRatePercent);

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

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
