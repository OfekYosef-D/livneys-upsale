import { describe, expect, it } from 'vitest';
import { assertOrderStatusTransition, canAddItems, getAllowedOrderStatusTransitions, getSubmissionStatus, parseOrderNumber } from './status';

describe('order status workflow', () => {
  it('allows only forward transitions and cancellation before packing', () => {
    expect(getAllowedOrderStatusTransitions('SUBMITTED')).toEqual(['APPROVED', 'CANCELLED']);
    expect(getAllowedOrderStatusTransitions('PACKED')).toEqual(['DELIVERED']);
    expect(assertOrderStatusTransition('APPROVED', 'PACKED')).toBe('PACKED');
    expect(() => assertOrderStatusTransition('DELIVERED', 'CANCELLED')).toThrow(expect.objectContaining({ code: 'ORDER_LOCKED' }));
  });

  it('turns orders sent after the cut-off into special requests', () => {
    const cutoff = new Date('2026-10-18T15:00:00.000Z');
    expect(getSubmissionStatus({ now: new Date('2026-10-18T14:59:00.000Z'), cutoff })).toBe('SUBMITTED');
    expect(getSubmissionStatus({ now: new Date('2026-10-18T15:01:00.000Z'), cutoff })).toBe('SPECIAL_REQUEST');
  });

  it('allows additions until the order is packed and parses order numbers from URLs', () => {
    expect(canAddItems('APPROVED')).toBe(true);
    expect(canAddItems('PACKED')).toBe(false);
    expect(parseOrderNumber('1042')).toBe(1042);
    expect(parseOrderNumber('0')).toBeNull();
    expect(parseOrderNumber('12abc')).toBeNull();
  });
});
