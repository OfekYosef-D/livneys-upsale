import { fields, z } from '@/lib/validation';

export const submitOrderAdditionSchema = z.object({
  customerId: fields.id,
  orderId: fields.id,
  idempotencyKey: fields.idempotencyKey,
  items: z.array(z.object({ productId: fields.id, quantity: z.coerce.number().int().positive() })).min(1, 'יש לבחור לפחות מוצר אחד.'),
});

export const reviewOrderAdditionSchema = z
  .object({
    requestId: fields.id,
    decision: z.enum(['APPROVED', 'REJECTED']),
    reason: fields.optionalText(1000),
  })
  .refine((value) => value.decision !== 'REJECTED' || Boolean(value.reason), {
    path: ['reason'],
    message: 'יש להזין סיבת דחייה.',
  });
