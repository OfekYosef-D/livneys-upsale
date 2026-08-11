import { describe, expect, it } from 'vitest';
import { assertAdditionAllowed, assertOrderCanBePacked } from './business-rules';

describe('order addition business rules', () => {
  it.each(['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED'] as const)('allows additions while order is %s', (status) => {
    expect(() => assertAdditionAllowed(status)).not.toThrow();
  });

  it.each(['DRAFT', 'PACKED', 'DELIVERED', 'CANCELLED'] as const)('locks additions while order is %s', (status) => {
    expect(() => assertAdditionAllowed(status)).toThrowError(expect.objectContaining({ code: 'ORDER_LOCKED' }));
  });

  it('blocks packing while a request is pending', () => {
    expect(() => assertOrderCanBePacked(1)).toThrowError(expect.objectContaining({ code: 'ORDER_LOCKED' }));
    expect(() => assertOrderCanBePacked(0)).not.toThrow();
  });
});
