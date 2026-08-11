import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  prisma: {
    orderAdditionRequest: { findUnique: vi.fn() },
    notificationJob: { upsert: vi.fn() },
  },
}));

vi.mock('../notifications/jobs', () => ({
  processNotificationJob: vi.fn(),
}));

const { prisma } = await import('../../lib/db');
const { processNotificationJob } = await import('../notifications/jobs');
const { enqueueOrderAdditionDecisionNotifications } = await import('./notifications');

describe('order addition decision notifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queues deduplicated email and WhatsApp notifications after approval', async () => {
    vi.mocked(prisma.orderAdditionRequest.findUnique).mockResolvedValue({
      id: 'request-001', status: 'APPROVED', rejectionReason: null, totalIncludingVat: 224.2,
      order: { id: 'order-001', orderNumber: 1042 },
      customer: {
        id: 'cust-001', name: 'מסעדת הדרום', contact: 'רונית',
        email: 'ronit@example.com', phone: '0501234567', isActive: true,
        notificationPreference: { emailEnabled: true, whatsappEnabled: true },
      },
    } as never);
    vi.mocked(prisma.notificationJob.upsert)
      .mockResolvedValueOnce({ id: 'job-email-001' } as never)
      .mockResolvedValueOnce({ id: 'job-whatsapp-001' } as never);

    await enqueueOrderAdditionDecisionNotifications({ requestId: 'request-001', decision: 'APPROVED' });

    expect(prisma.notificationJob.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.notificationJob.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupeKey: 'addition:request-001:APPROVED:EMAIL' },
      create: expect.objectContaining({ channel: 'EMAIL', templateKey: 'ORDER_ADDITION_APPROVED' }),
    }));
    expect(prisma.notificationJob.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupeKey: 'addition:request-001:APPROVED:WHATSAPP' },
      create: expect.objectContaining({ channel: 'WHATSAPP', templateKey: 'ORDER_ADDITION_APPROVED' }),
    }));
    expect(processNotificationJob).toHaveBeenCalledTimes(2);
    expect(processNotificationJob).toHaveBeenCalledWith('job-email-001');
    expect(processNotificationJob).toHaveBeenCalledWith('job-whatsapp-001');
  });

  it('includes the rejection reason in the queued customer message', async () => {
    vi.mocked(prisma.orderAdditionRequest.findUnique).mockResolvedValue({
      id: 'request-001', status: 'REJECTED', rejectionReason: 'המוצר אינו במלאי', totalIncludingVat: 224.2,
      order: { id: 'order-001', orderNumber: 1042 },
      customer: {
        id: 'cust-001', name: 'מסעדת הדרום', contact: 'רונית',
        email: 'ronit@example.com', phone: '0501234567', isActive: true,
        notificationPreference: { emailEnabled: true, whatsappEnabled: false },
      },
    } as never);
    vi.mocked(prisma.notificationJob.upsert).mockResolvedValue({ id: 'job-001' } as never);

    await enqueueOrderAdditionDecisionNotifications({ requestId: 'request-001', decision: 'REJECTED' });

    expect(prisma.notificationJob.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.notificationJob.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ message: expect.stringContaining('המוצר אינו במלאי') }),
    }));
  });
});
