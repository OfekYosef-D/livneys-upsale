import { beforeEach, describe, expect, it, vi } from 'vitest';
import { retryNotificationJobAction, sendNotificationJobNowAction, updateReminderRuleAction } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/action-result', () => ({
  actionOk: (data: unknown) => ({ ok: true, data }),
  actionError: (error: unknown) => ({
    ok: false,
    error: error instanceof Error ? error.message : 'Unexpected error',
  }),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    reminderRule: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/authorization', () => ({
  assertAdminAction: vi.fn(),
}));

vi.mock('./jobs', () => ({
  sendNotificationJobNow: vi.fn(),
  retryNotificationJob: vi.fn(),
}));

const { assertAdminAction } = await import('@/lib/authorization');
const { retryNotificationJob, sendNotificationJobNow } = await import('./jobs');
const { revalidatePath } = await import('next/cache');
const { prisma } = await import('@/lib/db');

const mockedAssertAdminAction = vi.mocked(assertAdminAction);
const mockedRetryNotificationJob = vi.mocked(retryNotificationJob);
const mockedSendNotificationJobNow = vi.mocked(sendNotificationJobNow);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedReminderRuleUpdate = vi.mocked(prisma.reminderRule.update);

describe('notification admin actions', () => {
  beforeEach(() => {
    mockedAssertAdminAction.mockReset();
    mockedRetryNotificationJob.mockReset();
    mockedSendNotificationJobNow.mockReset();
    mockedRevalidatePath.mockReset();
    mockedReminderRuleUpdate.mockReset();
  });

  it('requires admin authorization before retrying a notification job', async () => {
    mockedAssertAdminAction.mockRejectedValue(new Error('Unauthorized'));

    const result = await retryNotificationJobAction({ jobId: 'job-1' });

    expect(result).toEqual({ ok: false, error: 'Unauthorized' });
    expect(mockedRetryNotificationJob).not.toHaveBeenCalled();
  });

  it('retries a notification job and revalidates the monitoring page', async () => {
    mockedAssertAdminAction.mockResolvedValue({
      user: { id: 'admin', role: 'ADMIN', customerId: null },
      expires: '2026-07-01T00:00:00.000Z',
    });

    const result = await retryNotificationJobAction({ jobId: 'job-1' });

    expect(result).toEqual({ ok: true, data: { jobId: 'job-1' } });
    expect(mockedRetryNotificationJob).toHaveBeenCalledWith('job-1');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/admin/notifications');
  });

  it('sends a notification job now from the monitoring page', async () => {
    mockedAssertAdminAction.mockResolvedValue({
      user: { id: 'admin', role: 'ADMIN', customerId: null },
      expires: '2026-07-01T00:00:00.000Z',
    });

    const result = await sendNotificationJobNowAction({ jobId: 'job-1' });

    expect(result).toEqual({ ok: true, data: { jobId: 'job-1' } });
    expect(mockedSendNotificationJobNow).toHaveBeenCalledWith('job-1');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/admin/notifications');
  });

  it('updates WhatsApp reminder rule timing after admin authorization', async () => {
    mockedAssertAdminAction.mockResolvedValue({
      user: { id: 'admin', role: 'ADMIN', customerId: null },
      expires: '2026-07-01T00:00:00.000Z',
    });
    mockedReminderRuleUpdate.mockResolvedValue({
      id: 'rule-1',
      name: 'WhatsApp reminder',
      hoursBeforeDelivery: 24,
      isActive: true,
    } as never);

    const result = await updateReminderRuleAction({
      ruleId: 'rule-1',
      name: ' WhatsApp reminder ',
      hoursBeforeDelivery: 24,
      isActive: true,
    });

    expect(result).toEqual({ ok: true, data: { ruleId: 'rule-1' } });
    expect(mockedReminderRuleUpdate).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: {
        name: 'WhatsApp reminder',
        hoursBeforeDelivery: 24,
        isActive: true,
      },
      select: { id: true },
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/admin/notifications');
  });

  it('rejects invalid reminder timing before writing', async () => {
    mockedAssertAdminAction.mockResolvedValue({
      user: { id: 'admin', role: 'ADMIN', customerId: null },
      expires: '2026-07-01T00:00:00.000Z',
    });

    const result = await updateReminderRuleAction({
      ruleId: 'rule-1',
      name: 'WhatsApp reminder',
      hoursBeforeDelivery: 0,
      isActive: true,
    });

    expect(result.ok).toBe(false);
    expect(mockedReminderRuleUpdate).not.toHaveBeenCalled();
  });
});
