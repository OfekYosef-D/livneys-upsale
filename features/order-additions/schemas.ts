import { z } from 'zod';

const additionItemSchema = z.object({
  productId: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().int().positive(),
});

export const submitOrderAdditionSchema = z.object({
  customerId: z.string().trim().min(1).max(120),
  orderId: z.string().trim().min(1).max(120),
  idempotencyKey: z.string().uuid(),
  items: z.array(additionItemSchema).min(1),
});

export const reviewOrderAdditionSchema = z
  .object({
    requestId: z.string().trim().min(1).max(120),
    decision: z.enum(['APPROVED', 'REJECTED']),
    reason: z.preprocess((value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }, z.string().max(1000).nullable()),
  })
  .refine((value) => value.decision !== 'REJECTED' || Boolean(value.reason), {
    path: ['reason'],
    message: 'יש להזין סיבת דחייה.',
  });

export type SubmitOrderAdditionInput = z.infer<typeof submitOrderAdditionSchema>;
export type ReviewOrderAdditionInput = z.infer<typeof reviewOrderAdditionSchema>;
