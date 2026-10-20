import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));
vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('./jobs', () => ({ enqueueNotification: vi.fn(), deliverNow: vi.fn() }));

const { prisma } = await import('@/lib/db');
const { asMock } = await import('@/test/prisma-mock');
const { enqueueNotification, deliverNow } = await import('./jobs');
const { notifyAdditionDecision, notifyOrderStatus, notifyOrderStatusInBackground } = await import('./order-notifications');

const db = asMock(prisma);
const mockedEnqueue = vi.mocked(enqueueNotification);
const mockedDeliverNow = vi.mocked(deliverNow);

const customer = {
  id: 'cust-001',
  name: 'קפה דרום',
  contact: 'דנה',
  email: 'cafe@example.com',
  phone: '050-1234567',
  isActive: true,
  notificationPreference: null,
};

function order(status: string) {
  return { id: 'ord-1', orderNumber: 1042, status, totalIncludingVat: '1170.00', deliveryWindowStart: new Date('2026-07-02T05:00:00.000Z'), customer };
}

beforeEach(() => {
  db.$reset();
  mockedEnqueue.mockReset().mockResolvedValue(['job-1']);
  mockedDeliverNow.mockReset().mockResolvedValue(undefined);
});

describe('notifyOrderStatus', () => {
  it('queues the status message and delivers it right away', async () => {
    db.order.findUnique.mockResolvedValue(order('APPROVED'));

    await notifyOrderStatus('ord-1');

    expect(mockedEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-001',
      recipient: customer,
      orderId: 'ord-1',
      dedupeKey: 'order:ord-1:ORDER_APPROVED',
      content: expect.objectContaining({ templateKey: 'ORDER_APPROVED' }),
    }));
    expect(mockedDeliverNow).toHaveBeenCalledWith(['job-1']);
  });

  it('does nothing for statuses without a message or missing orders', async () => {
    db.order.findUnique.mockResolvedValueOnce(order('DRAFT')).mockResolvedValueOnce(null);

    await notifyOrderStatus('ord-1');
    await notifyOrderStatus('missing');

    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it('never throws from the background variant', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.order.findUnique.mockRejectedValue(new Error('db down'));

    expect(() => notifyOrderStatusInBackground('ord-1')).not.toThrow();
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
    consoleError.mockRestore();
  });
});

describe('notifyAdditionDecision', () => {
  const request = { id: 'req-1', status: 'REJECTED', rejectionReason: 'אזל', order: { id: 'ord-1', orderNumber: 1042 }, customer };

  it('queues the decision when it matches the stored request status', async () => {
    db.orderAdditionRequest.findUnique.mockResolvedValue(request);

    await notifyAdditionDecision('req-1', 'REJECTED');

    expect(mockedEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'ord-1',
      dedupeKey: 'addition:req-1:REJECTED',
      content: expect.objectContaining({ templateKey: 'ORDER_ADDITION_REJECTED' }),
    }));
    expect(mockedDeliverNow).toHaveBeenCalledWith(['job-1']);
  });

  it('ignores a decision that does not match the stored status', async () => {
    db.orderAdditionRequest.findUnique.mockResolvedValue(request);

    await notifyAdditionDecision('req-1', 'APPROVED');

    expect(mockedEnqueue).not.toHaveBeenCalled();
  });
});
