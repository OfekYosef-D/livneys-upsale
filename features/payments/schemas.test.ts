import { describe, expect, it } from 'vitest';
import { recordPaymentReceiptSchema } from './schemas';

const baseReceipt = {
  orderId: 'order-1',
  idempotencyKey: '9d31ee3f-3eb9-4cbc-b0ff-d48ed1daed71',
  method: 'CASH',
  receivedAt: new Date('2026-08-12T08:00:00.000Z'),
};

describe('payment receipt validation', () => {
  it.each([0.07, 0.14, 1.09, '12.34'])('accepts a positive amount with at most two decimals: %s', (amount) => {
    expect(recordPaymentReceiptSchema.parse({ ...baseReceipt, amount }).amount).toBe(Number(amount));
  });

  it('rejects amounts with more than two decimals', () => {
    expect(() => recordPaymentReceiptSchema.parse({ ...baseReceipt, amount: 1.009 })).toThrow();
  });

  it('requires a UUID idempotency key', () => {
    expect(recordPaymentReceiptSchema.safeParse({ ...baseReceipt, amount: 10, idempotencyKey: undefined }).success).toBe(false);
    expect(recordPaymentReceiptSchema.safeParse({ ...baseReceipt, amount: 10, idempotencyKey: 'retry' }).success).toBe(false);
  });
});
