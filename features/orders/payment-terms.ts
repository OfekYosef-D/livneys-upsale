export const paymentTermValues = ['NET_30', 'IMMEDIATE_OR_CASH'] as const;

export type PaymentTermValue = (typeof paymentTermValues)[number];

export const paymentTermLabels: Record<PaymentTermValue, string> = {
  NET_30: 'שוטף 30',
  IMMEDIATE_OR_CASH: 'תשלום מיידי / מזומן',
};

export const IMMEDIATE_PAYMENT_DISCOUNT_PERCENT = 5;

export function calculatePaymentTermsSummary(amountAfterPromotions: number, paymentTerm: PaymentTermValue) {
  const paymentDiscountPercent = paymentTerm === 'IMMEDIATE_OR_CASH' ? IMMEDIATE_PAYMENT_DISCOUNT_PERCENT : 0;
  const paymentDiscountTotal = roundCurrency(amountAfterPromotions * (paymentDiscountPercent / 100));

  return {
    paymentDiscountPercent,
    paymentDiscountTotal,
    total: roundCurrency(amountAfterPromotions - paymentDiscountTotal),
  };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
