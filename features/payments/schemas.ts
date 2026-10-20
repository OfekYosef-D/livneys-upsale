import { fields, z } from '@/lib/validation';

export const paymentMethodValues = ['BANK_TRANSFER', 'CASH', 'CHECK', 'CREDIT_CARD', 'OTHER'] as const;

export const paymentMethodLabels: Record<(typeof paymentMethodValues)[number], string> = {
  BANK_TRANSFER: 'העברה בנקאית',
  CASH: 'מזומן',
  CHECK: 'המחאה',
  CREDIT_CARD: 'כרטיס אשראי',
  OTHER: 'אחר',
};

export const recordPaymentReceiptSchema = z.object({
  orderId: fields.id,
  idempotencyKey: fields.idempotencyKey,
  amount: z.coerce.number().positive('הסכום חייב להיות גדול מאפס.').max(99_999_999.99).refine(
    (amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-8,
    'ניתן להזין עד שתי ספרות אחרי הנקודה.',
  ),
  method: z.enum(paymentMethodValues),
  reference: fields.optionalText(160),
  receivedAt: z.coerce.date(),
  note: fields.optionalText(500),
});

export const voidPaymentReceiptSchema = z.object({
  receiptId: fields.id,
  reason: z.string().trim().min(3, 'יש להזין סיבת ביטול.').max(500),
});
