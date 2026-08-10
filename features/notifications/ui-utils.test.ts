import { describe, expect, it } from 'vitest';
import { filterNotificationJobsForOperator } from './ui-utils';

describe('notification UI utilities', () => {
  it('filters jobs by dashboard search text and keeps operator-priority sorting', () => {
    const jobs = [
      notificationJob({ id: 'sent-match', status: 'SENT', orderId: 'order-alpha', scheduledAt: '2026-07-01T09:00:00.000Z' }),
      notificationJob({ id: 'failed-match', status: 'FAILED', orderId: 'order-alpha', scheduledAt: '2026-07-01T08:00:00.000Z' }),
      notificationJob({ id: 'other', status: 'FAILED', orderId: 'order-beta', orderNumber: 2002, scheduledAt: '2026-07-01T10:00:00.000Z' }),
    ];

    expect(filterNotificationJobsForOperator(jobs, 'order-alpha', 'all').map((job) => job.id)).toEqual([
      'failed-match',
      'sent-match',
    ]);

    expect(filterNotificationJobsForOperator(jobs, '1001', 'all').map((job) => job.id)).toEqual([
      'failed-match',
      'sent-match',
    ]);
  });
});

function notificationJob(overrides: Partial<NotificationJobFixture> = {}): NotificationJobFixture {
  return {
    id: 'job-1',
    status: 'SENT',
    scheduledAt: '2026-07-01T09:00:00.000Z',
    customerName: 'לקוח',
    customerContact: 'דנה',
    customerPhone: '+972501234567',
    templateKey: 'ORDER_RECEIVED',
    templateName: null,
    orderId: 'order-1',
    orderNumber: 1001,
    providerMessageId: null,
    message: null,
    errorMessage: null,
    ...overrides,
  };
}

type NotificationJobFixture = {
  id: string;
  status: string;
  scheduledAt: string;
  customerName: string;
  customerContact: string;
  customerPhone: string;
  templateKey: string;
  templateName: string | null;
  orderId: string | null;
  orderNumber: number | null;
  providerMessageId: string | null;
  message: string | null;
  errorMessage: string | null;
};
