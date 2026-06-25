import { z } from 'zod';

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
  items: z.array(orderItemInputSchema).min(1),
  notes: z.string().max(1000).optional(),
});

export type SaveDraftOrderInput = z.infer<typeof saveDraftOrderSchema>;
export type SubmitCustomerOrderInput = z.infer<typeof submitCustomerOrderSchema>;
