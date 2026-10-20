import { ValidationError } from '@/lib/errors';
import { roundCurrency } from '@/lib/money';
import { applyPromotion, summarizeLines, type PricedLine } from '../pricing/engine';
import type { OrderItem } from '../orders/quantity';
import { calculateOrderTotals, type OrderTotals, type PaymentTermValue } from '../orders/totals';
import { priceOrderItems, type OrderWriteContext } from '../orders/write';

export type OrderAdditionSnapshot = OrderTotals & { lines: PricedLine[] };

/**
 * Prices only the extra units, but evaluates promotions on the combined quantity so that a
 * deal reached thanks to the addition (e.g. "buy 12 get 2") is honoured. The discount already
 * granted on the original quantity is subtracted, so nothing is discounted twice. The original
 * order's payment term and VAT rate are kept.
 */
export function buildOrderAdditionSnapshot({
  context,
  existingItems,
  items,
  paymentTerm,
  now,
}: {
  context: OrderWriteContext;
  existingItems: readonly OrderItem[];
  items: readonly OrderItem[];
  paymentTerm: PaymentTermValue;
  now: Date;
}): OrderAdditionSnapshot {
  const additions = priceOrderItems(context, items, now).lines;
  if (additions.length === 0) throw new ValidationError('בקשת תוספת חייבת לכלול לפחות מוצר אחד.');

  const existingQuantity = new Map<string, number>();
  for (const item of existingItems) {
    existingQuantity.set(item.productId, (existingQuantity.get(item.productId) ?? 0) + item.quantity);
  }

  const combinedLines = new Map(
    priceOrderItems(
      context,
      additions.map((line) => ({ productId: line.productId, quantity: line.quantity + (existingQuantity.get(line.productId) ?? 0) })),
      now,
    ).lines.map((line) => [line.productId, line]),
  );

  const lines = additions.map((addition): PricedLine => {
    const combined = combinedLines.get(addition.productId) ?? addition;
    const existing = existingQuantity.get(addition.productId) ?? 0;
    const alreadyGranted = existing > 0 && combined.promotionSnapshot
      ? applyPromotion(combined.promotionSnapshot, combined.listUnitPrice, existing).discountTotal
      : 0;
    const lineSubtotal = roundCurrency(combined.listUnitPrice * addition.quantity);
    const discountTotal = Math.min(lineSubtotal, Math.max(0, roundCurrency(combined.discountTotal - alreadyGranted)));

    return {
      ...combined,
      quantity: addition.quantity,
      lineSubtotal,
      discountTotal,
      lineTotal: roundCurrency(lineSubtotal - discountTotal),
      promotionId: discountTotal > 0 ? combined.promotionId : null,
      promotionSnapshot: discountTotal > 0 ? combined.promotionSnapshot : null,
    };
  });

  return {
    ...calculateOrderTotals({ ...summarizeLines(lines), paymentTerm, vatRatePercent: context.vatRatePercent }),
    lines,
  };
}
