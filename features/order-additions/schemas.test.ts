import { describe, expect, it } from 'vitest';
import { reviewOrderAdditionSchema, submitOrderAdditionSchema } from './schemas';

describe('order addition schemas', () => {
  it('accepts a positive additions-only request', () => {
    expect(submitOrderAdditionSchema.parse({
      customerId: 'cust-001',
      orderId: 'order-001',
      idempotencyKey: '1f4106db-26c3-49ed-9cf6-c625dd18fc73',
      items: [{ productId: 'product-001', quantity: 6 }],
    })).toEqual({
      customerId: 'cust-001',
      orderId: 'order-001',
      idempotencyKey: '1f4106db-26c3-49ed-9cf6-c625dd18fc73',
      items: [{ productId: 'product-001', quantity: 6 }],
    });
  });

  it('rejects zero and negative quantities', () => {
    expect(() => submitOrderAdditionSchema.parse({
      customerId: 'cust-001',
      orderId: 'order-001',
      idempotencyKey: '1f4106db-26c3-49ed-9cf6-c625dd18fc73',
      items: [{ productId: 'product-001', quantity: 0 }],
    })).toThrow();
  });

  it('requires a rejection reason but not an approval reason', () => {
    expect(() => reviewOrderAdditionSchema.parse({ requestId: 'request-001', decision: 'REJECTED' })).toThrow();
    expect(reviewOrderAdditionSchema.parse({ requestId: 'request-001', decision: 'APPROVED' })).toEqual({
      requestId: 'request-001',
      decision: 'APPROVED',
      reason: null,
    });
  });
});
