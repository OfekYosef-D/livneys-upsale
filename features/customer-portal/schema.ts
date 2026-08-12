import { z } from 'zod';
import { paymentTermValues } from '../orders/payment-terms';

export const orderItemInputSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().nonnegative(),
});

export const saveDraftOrderSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(orderItemInputSchema),
});

export const submitCustomerOrderSchema = z.object({
  customerId: z.string().min(1),
  idempotencyKey: z.string().uuid(),
  vatRatePercent: z.coerce.number().min(0).max(100),
  items: z.array(orderItemInputSchema).min(1),
  notes: z.string().max(1000).optional(),
  paymentTerm: z.enum(paymentTermValues),
  commercialTermsAccepted: z.boolean().refine((accepted) => accepted, {
    message: 'יש לאשר שההזמנה היא עסקית ואת פרטי ההזמנה לפני השליחה.',
  }),
});

export type SaveDraftOrderInput = z.infer<typeof saveDraftOrderSchema>;
export type SubmitCustomerOrderInput = z.infer<typeof submitCustomerOrderSchema>;
