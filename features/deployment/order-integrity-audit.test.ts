import { describe, expect, it } from 'vitest';
import { assertNoActiveOrderDuplicates, summarizeActiveOrderDuplicates } from './order-integrity-audit';

describe('order integrity audit', () => {
  it('groups non-cancelled duplicate orders by customer and delivery window', () => {
    const result = summarizeActiveOrderDuplicates([
      {
        id: 'order-1',
        orderNumber: 1001,
        customerId: 'cust-1',
        deliveryWindowStart: new Date('2026-08-12T08:00:00.000Z'),
        status: 'SUBMITTED',
      },
      {
        id: 'order-2',
        orderNumber: 1002,
        customerId: 'cust-1',
        deliveryWindowStart: new Date('2026-08-12T08:00:00.000Z'),
        status: 'APPROVED',
      },
      {
        id: 'order-3',
        orderNumber: 1003,
        customerId: 'cust-1',
        deliveryWindowStart: new Date('2026-08-12T08:00:00.000Z'),
        status: 'CANCELLED',
      },
      {
        id: 'order-4',
        orderNumber: 1004,
        customerId: 'cust-2',
        deliveryWindowStart: new Date('2026-08-19T08:00:00.000Z'),
        status: 'SUBMITTED',
      },
    ]);

    expect(result).toEqual({
      duplicateGroupCount: 1,
      duplicateOrderCount: 2,
      groups: [
        {
          customerId: 'cust-1',
          deliveryWindowStart: '2026-08-12T08:00:00.000Z',
          orders: [
            { id: 'order-1', orderNumber: 1001, status: 'SUBMITTED' },
            { id: 'order-2', orderNumber: 1002, status: 'APPROVED' },
          ],
        },
      ],
    });
  });

  it('reports a clean result when every delivery window has at most one non-cancelled order', () => {
    expect(summarizeActiveOrderDuplicates([
      {
        id: 'order-1',
        orderNumber: 1001,
        customerId: 'cust-1',
        deliveryWindowStart: new Date('2026-08-12T08:00:00.000Z'),
        status: 'DELIVERED',
      },
      {
        id: 'order-2',
        orderNumber: 1002,
        customerId: 'cust-1',
        deliveryWindowStart: new Date('2026-08-19T08:00:00.000Z'),
        status: 'SUBMITTED',
      },
    ])).toEqual({
      duplicateGroupCount: 0,
      duplicateOrderCount: 0,
      groups: [],
    });
  });

  it('fails the migration gate without mutating duplicate orders', () => {
    expect(() => assertNoActiveOrderDuplicates({
      duplicateGroupCount: 1,
      duplicateOrderCount: 2,
      groups: [],
    })).toThrow('Found 2 non-cancelled orders across 1 duplicate delivery window');
  });
});
