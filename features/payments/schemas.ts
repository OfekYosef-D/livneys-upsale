import { z } from 'zod';

export const paymentMethodValues = ['BANK_TRANSFER', 'CASH', 'CHECK', 'CREDIT_CARD', 'OTHER'] as const;

export const recordPaymentReceiptSchema = z.object({
  orderId: z.string().trim().min(1),
  idempotencyKey: z.string().uuid(),
  amount: z.coerce.number().positive().max(99_999_999.99).refine(
    (amount) => Math.abs((amount * 100) - Math.round(amount * 100)) < 1e-8,
    'ניתן להזין עד שתי ספרות אחרי הנקודה.',
  ),
  method: z.enum(paymentMethodValues),
  reference: z.string().trim().max(160).nullable().optional(),
  receivedAt: z.coerce.date(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const voidPaymentReceiptSchema = z.object({
  receiptId: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(500),
});
