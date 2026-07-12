import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNotificationManagementData } from './queries';

vi.mock('@/lib/db', () => ({
  prisma: {
    notificationJob: {
      findMany: vi.fn(),
    },
    whatsAppWebhookEvent: {
      findMany: vi.fn(),
    },
    reminderRule: {
      findMany: vi.fn(),
    },
  },
}));

const { prisma } = await import('@/lib/db');
const mockedNotificationJobFindMany = vi.mocked(prisma.notificationJob.findMany);
const mockedWebhookEventFindMany = vi.mocked(prisma.whatsAppWebhookEvent.findMany);
const mockedReminderRuleFindMany = vi.mocked(prisma.reminderRule.findMany);

describe('notification management queries', () => {
  beforeEach(() => {
    process.env.WHATSAPP_SEND_ENABLED = 'false';
    mockedNotificationJobFindMany.mockReset();
    mockedWebhookEventFindMany.mockReset();
    mockedReminderRuleFindMany.mockReset();
  });

  it('maps notification jobs and webhook events for the admin monitoring page', async () => {
    mockedNotificationJobFindMany.mockResolvedValue([
      {
        id: 'job-1',
        customerId: 'cust-001',
        orderId: 'ord-1',
        channel: 'WHATSAPP',
        templateKey: 'ORDER_RECEIVED',
        templateName: null,
        status: 'DRY_RUN',
        dryRun: true,
        message: 'Preview',
        scheduledAt: new Date('2026-07-01T10:00:00.000Z'),
        nextAttemptAt: new Date('2026-07-01T10:05:00.000Z'),
        lastAttemptAt: new Date('2026-07-01T10:00:30.000Z'),
        processedAt: new Date('2026-07-01T10:01:00.000Z'),
        attempts: 1,
        maxAttempts: 3,
        providerMessageId: 'wamid.123',
        errorMessage: 'Previous timeout',
        customer: { id: 'cust-001', name: 'Cafe South', contact: 'Dana', phone: '050-123-4567' },
        order: { id: 'ord-1', status: 'SUBMITTED', total: 123.5 },
        reminderJob: null,
      },
    ] as never);
    mockedWebhookEventFindMany.mockResolvedValue([
      {
        id: 'event-1',
        kind: 'MESSAGE',
        providerStatus: null,
        providerMessageId: 'wamid.inbound',
        fromPhone: '+972501234567',
        customerId: 'cust-001',
        errorMessage: null,
        receivedAt: new Date('2026-07-01T10:02:00.000Z'),
        customer: { id: 'cust-001', name: 'Cafe South' },
      },
    ] as never);
    mockedReminderRuleFindMany.mockResolvedValue([
      {
        id: 'rule-1',
        name: 'WhatsApp reminder',
        channel: 'WHATSAPP',
        hoursBeforeDelivery: 48,
        isActive: true,
        routeId: 'route-south',
        route: { id: 'route-south', name: 'South', region: 'South' },
      },
    ] as never);

    const data = await getNotificationManagementData();

    expect(data.config.sendEnabled).toBe(false);
    expect(data.summary.dryRun).toBe(1);
    expect(data.jobs[0]).toMatchObject({
      id: 'job-1',
      customerName: 'Cafe South',
      templateKey: 'ORDER_RECEIVED',
      status: 'DRY_RUN',
      orderId: 'ord-1',
      attempts: 1,
      maxAttempts: 3,
      nextAttemptAt: '2026-07-01T10:05:00.000Z',
      lastAttemptAt: '2026-07-01T10:00:30.000Z',
      providerMessageId: 'wamid.123',
      errorMessage: 'Previous timeout',
    });
    expect(data.webhookEvents[0]).toMatchObject({
      id: 'event-1',
      kind: 'MESSAGE',
      customerName: 'Cafe South',
    });
    expect(data.reminderRules[0]).toMatchObject({
      id: 'rule-1',
      name: 'WhatsApp reminder',
      routeName: 'South',
      hoursBeforeDelivery: 48,
      isActive: true,
    });
  });
});
