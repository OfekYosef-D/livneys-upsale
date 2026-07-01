import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  processWhatsAppWebhookPayload,
  verifyWhatsAppWebhookSignature,
} from './webhooks';

vi.mock('@/lib/db', () => ({
  prisma: {
    notificationJob: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    notificationEvent: {
      updateMany: vi.fn(),
    },
    whatsAppWebhookEvent: {
      create: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
    },
    customerContactLog: {
      create: vi.fn(),
    },
  },
}));

const { prisma } = await import('@/lib/db');

const mockedNotificationJobFindFirst = vi.mocked(prisma.notificationJob.findFirst);
const mockedNotificationJobUpdate = vi.mocked(prisma.notificationJob.update);
const mockedNotificationEventUpdateMany = vi.mocked(prisma.notificationEvent.updateMany);
const mockedWebhookEventCreate = vi.mocked(prisma.whatsAppWebhookEvent.create);
const mockedCustomerFindMany = vi.mocked(prisma.customer.findMany);
const mockedContactLogCreate = vi.mocked(prisma.customerContactLog.create);

describe('WhatsApp webhooks', () => {
  beforeEach(() => {
    mockedNotificationJobFindFirst.mockReset();
    mockedNotificationJobUpdate.mockReset();
    mockedNotificationEventUpdateMany.mockReset();
    mockedWebhookEventCreate.mockReset();
    mockedCustomerFindMany.mockReset();
    mockedContactLogCreate.mockReset();
  });

  it('validates Meta webhook signatures when app secret is configured', () => {
    const body = '{"entry":[]}';
    const digest = createHmac('sha256', 'secret').update(body).digest('hex');

    expect(verifyWhatsAppWebhookSignature(body, `sha256=${digest}`, 'secret')).toBe(true);
    expect(verifyWhatsAppWebhookSignature(body, 'sha256=bad', 'secret')).toBe(false);
  });

  it('updates notification jobs from provider status webhooks', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    mockedNotificationJobFindFirst.mockResolvedValue({
      id: 'job-1',
      customerId: 'cust-001',
    } as never);

    await processWhatsAppWebhookPayload(
      {
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: 'wamid.123',
                      status: 'delivered',
                      timestamp: '1780000000',
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      { now },
    );

    expect(mockedNotificationJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'SENT',
        providerMessageId: 'wamid.123',
      }),
    });
    expect(mockedNotificationEventUpdateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'wamid.123' },
      data: { providerStatus: 'delivered' },
    });
    expect(mockedWebhookEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: 'status:wamid.123:delivered:1780000000',
        kind: 'STATUS',
        providerMessageId: 'wamid.123',
        notificationJobId: 'job-1',
        customerId: 'cust-001',
        processedAt: now,
      }),
    });
  });

  it('logs inbound replies against matching customer phone numbers', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    mockedCustomerFindMany.mockResolvedValue([
      {
        id: 'cust-001',
        phone: '050-123-4567',
      },
    ] as never);

    await processWhatsAppWebhookPayload(
      {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.inbound',
                      from: '972501234567',
                      timestamp: '1780000001',
                      text: { body: 'תודה, נזמין היום' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      { now },
    );

    expect(mockedContactLogCreate).toHaveBeenCalledWith({
      data: {
        customerId: 'cust-001',
        channel: 'WHATSAPP',
        summary: 'תודה, נזמין היום',
      },
    });
    expect(mockedWebhookEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: 'message:wamid.inbound',
        kind: 'MESSAGE',
        providerMessageId: 'wamid.inbound',
        fromPhone: '+972501234567',
        customerId: 'cust-001',
      }),
    });
  });
});
