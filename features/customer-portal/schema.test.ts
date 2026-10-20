import { describe, expect, it } from 'vitest';
import { saveDraftOrderSchema, submitCustomerOrderSchema } from './schema';

const validSubmission = {
  customerId: 'cust-1',
  idempotencyKey: '9d31ee3f-3eb9-4cbc-b0ff-d48ed1daed71',
  items: [{ productId: 'product-1', quantity: '2' }],
  paymentTerm: 'NET_30',
  vatRatePercent: '18',
  legalDocumentSetVersion: '2026-08-12-review',
  commercialTermsAccepted: true,
  notes: '  ',
};

describe('submitCustomerOrderSchema', () => {
  it('parses a valid submission, coercing numbers and nulling empty notes', () => {
    expect(submitCustomerOrderSchema.parse(validSubmission)).toEqual({
      ...validSubmission,
      items: [{ productId: 'product-1', quantity: 2 }],
      vatRatePercent: 18,
      notes: null,
    });
  });

  it('requires a UUID idempotency key, the VAT rate and the legal document set version', () => {
    expect(submitCustomerOrderSchema.safeParse({ ...validSubmission, idempotencyKey: 'not-a-uuid' }).success).toBe(false);
    expect(submitCustomerOrderSchema.safeParse({ ...validSubmission, idempotencyKey: undefined }).success).toBe(false);
    expect(submitCustomerOrderSchema.safeParse({ ...validSubmission, vatRatePercent: undefined }).success).toBe(false);
    expect(submitCustomerOrderSchema.safeParse({ ...validSubmission, legalDocumentSetVersion: undefined }).success).toBe(false);
  });

  it('requires the B2B commercial terms to be accepted', () => {
    const result = submitCustomerOrderSchema.safeParse({ ...validSubmission, commercialTermsAccepted: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('יש לאשר שההזמנה היא עסקית ואת פרטי ההזמנה לפני השליחה.');
    expect(submitCustomerOrderSchema.safeParse({ ...validSubmission, commercialTermsAccepted: 'true' }).success).toBe(false);
  });

  it('rejects empty orders, negative or fractional quantities and unknown payment terms', () => {
    expect(submitCustomerOrderSchema.safeParse({ ...validSubmission, items: [] }).error?.issues[0]?.message).toBe('לא ניתן לשלוח הזמנה ריקה.');
    expect(submitCustomerOrderSchema.safeParse({ ...validSubmission, items: [{ productId: 'p', quantity: -1 }] }).success).toBe(false);
    expect(submitCustomerOrderSchema.safeParse({ ...validSubmission, items: [{ productId: 'p', quantity: 1.5 }] }).success).toBe(false);
    expect(submitCustomerOrderSchema.safeParse({ ...validSubmission, paymentTerm: 'NET_60' }).success).toBe(false);
  });
});

describe('saveDraftOrderSchema', () => {
  it('allows an empty cart and zero quantities (removed lines)', () => {
    expect(saveDraftOrderSchema.parse({ customerId: 'cust-1', items: [] })).toEqual({ customerId: 'cust-1', items: [] });
    expect(saveDraftOrderSchema.parse({ customerId: 'cust-1', items: [{ productId: 'p', quantity: '0' }] }).items)
      .toEqual([{ productId: 'p', quantity: 0 }]);
  });

  it('rejects negative quantities and oversized carts', () => {
    expect(saveDraftOrderSchema.safeParse({ customerId: 'cust-1', items: [{ productId: 'p', quantity: -2 }] }).success).toBe(false);
    const items = Array.from({ length: 501 }, (_, index) => ({ productId: `p-${index}`, quantity: 1 }));
    expect(saveDraftOrderSchema.safeParse({ customerId: 'cust-1', items }).success).toBe(false);
  });
});
