import type { OrderSource } from '@prisma/client';
import { ValidationError } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { MINIMUM_INSTITUTIONAL_ORDER_TOTAL } from '../owner-rules/constants';

export { MINIMUM_INSTITUTIONAL_ORDER_TOTAL };

/** Customers must reach the institutional minimum (after promotions, before VAT). Admin orders are exempt. */
export function assertMinimumOrderTotal(source: OrderSource, totalAfterPromotions: number): void {
  if (source === 'CUSTOMER' && totalAfterPromotions < MINIMUM_INSTITUTIONAL_ORDER_TOTAL) {
    throw new ValidationError(`מינימום הזמנה הוא ${formatMoney(MINIMUM_INSTITUTIONAL_ORDER_TOTAL)} לפני מע״מ.`);
  }
}

/** How much is still missing to reach the minimum; used to guide the customer in the cart. */
export function getMissingForMinimum(totalAfterPromotions: number): number {
  return Math.max(0, MINIMUM_INSTITUTIONAL_ORDER_TOTAL - totalAfterPromotions);
}
