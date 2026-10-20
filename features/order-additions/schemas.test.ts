import { describe, expect, it } from 'vitest';
import { reviewOrderAdditionSchema, submitOrderAdditionSchema } from './schemas';

const addition = {
  customerId: 'cust-001',
  orderId: 'order-001',
  idempotencyKey: '1f4106db-26c3-49ed-9cf6-c625dd18fc73',
  items: [{ productId: 'product-001', quantity: '6' }],
};

describe('submitOrderAdditionSchema', () => {
  it('accepts a positive additions-only request and coerces quantities', () => {
    expect(submitOrderAdditionSchema.parse(addition)).toEqual({ ...addition, items: [{ productId: 'product-001', quantity: 6 }] });
  });

  it('rejects zero, negative and fractional quantities', () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(submitOrderAdditionSchema.safeParse({ ...addition, items: [{ productId: 'product-001', quantity }] }).success).toBe(false);
    }
  });

  it('requires at least one item and a UUID idempotency key', () => {
    expect(submitOrderAdditionSchema.safeParse({ ...addition, items: [] }).error?.issues[0]?.message).toBe('יש לבחור לפחות מוצר אחד.');
    expect(submitOrderAdditionSchema.safeParse({ ...addition, idempotencyKey: 'abc' }).success).toBe(false);
  });
});

describe('reviewOrderAdditionSchema', () => {
  it('requires a rejection reason', () => {
    for (const reason of [undefined, '', '   ']) {
      const result = reviewOrderAdditionSchema.safeParse({ requestId: 'request-001', decision: 'REJECTED', reason });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({ path: ['reason'], message: 'יש להזין סיבת דחייה.' });
    }
  });

  it('accepts a trimmed rejection reason', () => {
    expect(reviewOrderAdditionSchema.parse({ requestId: 'request-001', decision: 'REJECTED', reason: ' אזל ' }))
      .toEqual({ requestId: 'request-001', decision: 'REJECTED', reason: 'אזל' });
  });

  it('does not require a reason for approval', () => {
    expect(reviewOrderAdditionSchema.parse({ requestId: 'request-001', decision: 'APPROVED' })).toEqual({
      requestId: 'request-001',
      decision: 'APPROVED',
      reason: null,
    });
  });

  it('rejects unknown decisions', () => {
    expect(reviewOrderAdditionSchema.safeParse({ requestId: 'request-001', decision: 'PENDING' }).success).toBe(false);
  });
});
