import { describe, expect, it } from 'vitest';
import { submitCustomerOrderSchema } from './schema';

describe('customer order submission schema', () => {
  it('requires and preserves a UUID idempotency key', () => {
    const input = {
      customerId: 'cust-1',
      idempotencyKey: '9d31ee3f-3eb9-4cbc-b0ff-d48ed1daed71',
      items: [{ productId: 'product-1', qty: 2 }],
      paymentTerm: 'NET_30',
      vatRatePercent: 18,
      commercialTermsAccepted: true,
    };

    expect(submitCustomerOrderSchema.parse(input)).toMatchObject({
      idempotencyKey: input.idempotencyKey,
    });
    expect(submitCustomerOrderSchema.safeParse({ ...input, idempotencyKey: 'not-a-uuid' }).success).toBe(false);
    expect(submitCustomerOrderSchema.safeParse({ ...input, idempotencyKey: undefined }).success).toBe(false);
    expect(submitCustomerOrderSchema.safeParse({ ...input, vatRatePercent: undefined }).success).toBe(false);
  });
});
