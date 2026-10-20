import { fields, z } from '@/lib/validation';
import { paymentTermValues } from '../orders/totals';

export const orderItemSchema = z.object({
  productId: fields.id,
  quantity: z.coerce.number().int().nonnegative(),
});

export const saveDraftOrderSchema = z.object({
  customerId: fields.id,
  items: z.array(orderItemSchema).max(500),
});

export const submitCustomerOrderSchema = z.object({
  customerId: fields.id,
  idempotencyKey: fields.idempotencyKey,
  vatRatePercent: z.coerce.number().min(0).max(100),
  legalDocumentSetVersion: z.string().trim().min(1).max(80),
  items: z.array(orderItemSchema).min(1, 'לא ניתן לשלוח הזמנה ריקה.').max(500),
  notes: fields.optionalText(1000),
  paymentTerm: z.enum(paymentTermValues),
  commercialTermsAccepted: z.literal(true, 'יש לאשר שההזמנה היא עסקית ואת פרטי ההזמנה לפני השליחה.'),
});
