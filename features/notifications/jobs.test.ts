import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWhatsAppConfig } from './config';
import {
  enqueueOrderLifecycleWhatsApp,
  claimNotificationJob,
  processNotificationJob,
  retryNotificationJob,
  sendNotificationJobNow,
} from './jobs';

vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
    notificationJob: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    notificationEvent: {
      create: vi.fn(),
    },
    reminderJob: {
      update: vi.fn(),
    },
  },
}));

vi.mock('./sender', () => ({
  sendWhatsAppTemplate: vi.fn(),
  PermanentWhatsAppError: class PermanentWhatsAppError extends Error {},
}));

const { prisma } = await import('@/lib/db');
const { sendWhatsAppTemplate, PermanentWhatsAppError } = await import('./sender');

const mockedOrderFindUnique = vi.mocked(prisma.order.findUnique);
const mockedNotificationJobUpsert = vi.mocked(prisma.notificationJob.upsert);
const mockedNotificationJobFindUnique = vi.mocked(prisma.notificationJob.findUnique);
const mockedNotificationJobUpdateMany = vi.mocked(prisma.notificationJob.updateMany);
const mockedNotificationJobUpdate = vi.mocked(prisma.notificationJob.update);
const mockedNotificationEventCreate = vi.mocked(prisma.notificationEvent.create);
const mockedSendWhatsAppTemplate = vi.mocked(sendWhatsAppTemplate);

describe('notification jobs', () => {
  beforeEach(() => {
    mockedOrderFindUnique.mockReset();
    mockedNotificationJobUpsert.mockReset();
    mockedNotificationJobFindUnique.mockReset();
    mockedNotificationJobUpdateMany.mockReset();
    mockedNotificationJobUpdate.mockReset();
    mockedNotificationEventCreate.mockReset();
    mockedSendWhatsAppTemplate.mockReset();
  });

  it('queues order lifecycle WhatsApp jobs for eligible customers in dry-run mode', async () => {
    mockedOrderFindUnique.mockResolvedValue({
      id: 'ord-1',
      orderNumber: 1001,
      status: 'SUBMITTED',
      total: 123.5,
      deliveryWindowStart: new Date('2026-07-01T08:00:00.000Z'),
      customer: {
        id: 'cust-001',
        name: 'Cafe South',
        contact: 'Dana',
        phone: '050-123-4567',
        isActive: true,
        notificationPreference: { whatsappEnabled: true },
      },
    } as never);
    mockedNotificationJobUpsert.mockResolvedValue({ id: 'job-1', status: 'PENDING' } as never);

    const result = await enqueueOrderLifecycleWhatsApp({
      orderId: 'ord-1',
      config: getWhatsAppConfig({
        WHATSAPP_SEND_ENABLED: 'false',
        WHATSAPP_TEMPLATE_ORDER_RECEIVED: 'livneys_order_received_he',
        WHATSAPP_TEMPLATE_LANGUAGE: 'en_US',
        NEXTAUTH_URL: 'https://orders.example.com',
      }),
    });

    expect(result).toEqual({ enqueued: true, jobId: 'job-1' });
    expect(mockedNotificationJobUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dedupeKey: 'order:ord-1:ORDER_RECEIVED' },
        create: expect.objectContaining({
          customerId: 'cust-001',
          orderId: 'ord-1',
          templateKey: 'ORDER_RECEIVED',
          templateName: 'livneys_order_received_he',
          dryRun: true,
          payload: expect.objectContaining({
            languageCode: 'en_US',
            bodyParameters: [
              { name: 'customer_name', text: 'Dana' },
              { name: 'order_id', text: '#1001' },
              { name: 'delivery_date', text: '01/07/2026' },
            ],
          }),
          dedupeKey: 'order:ord-1:ORDER_RECEIVED',
        }),
      }),
    );
  });

  it('does not queue WhatsApp jobs for customers without WhatsApp preference enabled', async () => {
    mockedOrderFindUnique.mockResolvedValue({
      id: 'ord-1',
      orderNumber: 1001,
      status: 'SUBMITTED',
      total: 123.5,
      deliveryWindowStart: new Date('2026-07-01T08:00:00.000Z'),
      customer: {
        id: 'cust-001',
        name: 'Cafe South',
        contact: 'Dana',
        phone: '050-123-4567',
        isActive: true,
        notificationPreference: { whatsappEnabled: false },
      },
    } as never);

    const result = await enqueueOrderLifecycleWhatsApp({
      orderId: 'ord-1',
      config: getWhatsAppConfig({ WHATSAPP_SEND_ENABLED: 'false' }),
    });

    expect(result).toEqual({ enqueued: false, reason: 'whatsapp_disabled' });
    expect(mockedNotificationJobUpsert).not.toHaveBeenCalled();
  });

  it('does not queue live WhatsApp jobs when the required template is missing', async () => {
    mockedOrderFindUnique.mockResolvedValue({
      id: 'ord-1',
      orderNumber: 1001,
      status: 'APPROVED',
      total: 123.5,
      deliveryWindowStart: new Date('2026-07-01T08:00:00.000Z'),
      customer: {
        id: 'cust-001',
        name: 'Cafe South',
        contact: 'Dana',
        phone: '050-123-4567',
        isActive: true,
        notificationPreference: { whatsappEnabled: true },
      },
    } as never);

    const result = await enqueueOrderLifecycleWhatsApp({
      orderId: 'ord-1',
      config: getWhatsAppConfig({
        WHATSAPP_SEND_ENABLED: 'true',
        WHATSAPP_ACCESS_TOKEN: 'token',
        WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
      }),
    });

    expect(result).toEqual({ enqueued: false, reason: 'template_not_configured' });
    expect(mockedNotificationJobUpsert).not.toHaveBeenCalled();
  });

  it('processes pending jobs and records dry-run notification events', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    mockedNotificationJobUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockedNotificationJobFindUnique.mockResolvedValue({
      id: 'job-1',
      customerId: 'cust-001',
      reminderJobId: null,
      templateKey: 'ORDER_RECEIVED',
      templateName: null,
      payload: {
        to: '+972501234567',
        languageCode: 'he',
        bodyParameters: ['Dana', 'Cafe South'],
      },
      message: 'Preview message',
      attempts: 1,
      maxAttempts: 3,
    } as never);
    mockedSendWhatsAppTemplate.mockResolvedValue({ mode: 'dry-run', providerMessageId: null });

    const result = await processNotificationJob('job-1', {
      now,
      config: getWhatsAppConfig({ WHATSAPP_SEND_ENABLED: 'false' }),
    });

    expect(result).toEqual({ processed: true, status: 'DRY_RUN' });
    expect(mockedNotificationJobUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
        status: 'PENDING',
        scheduledAt: { lte: now },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: {
        status: 'PROCESSING',
        lastAttemptAt: now,
        attempts: { increment: 1 },
        errorMessage: null,
      },
    });
    expect(mockedNotificationJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'DRY_RUN',
        dryRun: true,
        processedAt: now,
        nextAttemptAt: null,
      }),
    });
    expect(mockedNotificationEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: 'cust-001',
        notificationJobId: 'job-1',
        channel: 'WHATSAPP',
        type: 'ORDER_RECEIVED',
        status: 'SENT',
        dryRun: true,
        message: 'Preview message',
      }),
    });
  });

  it('atomically claims pending jobs before sending', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    mockedNotificationJobUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockedNotificationJobFindUnique.mockResolvedValue({ id: 'job-1', status: 'PROCESSING', attempts: 1 } as never);

    const job = await claimNotificationJob('job-1', { now });

    expect(job).toEqual({ id: 'job-1', status: 'PROCESSING', attempts: 1 });
    expect(mockedNotificationJobUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
        status: 'PENDING',
        scheduledAt: { lte: now },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: {
        status: 'PROCESSING',
        lastAttemptAt: now,
        attempts: { increment: 1 },
        errorMessage: null,
      },
    });
  });

  it('skips already claimed jobs without sending', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    mockedNotificationJobUpdateMany.mockResolvedValue({ count: 0 } as never);

    const result = await processNotificationJob('job-1', {
      now,
      config: getWhatsAppConfig({ WHATSAPP_SEND_ENABLED: 'false' }),
    });

    expect(result).toEqual({ processed: false, reason: 'not_claimed' });
    expect(mockedNotificationJobFindUnique).not.toHaveBeenCalled();
    expect(mockedSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  it('prevents duplicate sends when two processors race for the same job', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    mockedNotificationJobUpdateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 0 } as never);
    mockedNotificationJobFindUnique.mockResolvedValue({
      id: 'job-1',
      customerId: 'cust-001',
      reminderJobId: null,
      templateKey: 'ORDER_RECEIVED',
      templateName: null,
      payload: {
        to: '+972501234567',
        languageCode: 'he',
        bodyParameters: ['Dana', 'Cafe South'],
      },
      message: 'Preview message',
      attempts: 1,
      maxAttempts: 3,
    } as never);
    mockedSendWhatsAppTemplate.mockResolvedValue({ mode: 'dry-run', providerMessageId: null });

    await processNotificationJob('job-1', { now, config: getWhatsAppConfig({ WHATSAPP_SEND_ENABLED: 'false' }) });
    await processNotificationJob('job-1', { now, config: getWhatsAppConfig({ WHATSAPP_SEND_ENABLED: 'false' }) });

    expect(mockedSendWhatsAppTemplate).toHaveBeenCalledTimes(1);
  });

  it('schedules transient failures for retry until max attempts', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    mockedNotificationJobUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockedNotificationJobFindUnique.mockResolvedValue({
      id: 'job-1',
      customerId: 'cust-001',
      reminderJobId: null,
      templateKey: 'ORDER_RECEIVED',
      templateName: 'livneys_order_received_he',
      payload: {
        to: '+972501234567',
        languageCode: 'he',
        bodyParameters: ['Dana', 'Cafe South'],
      },
      message: 'Preview message',
      attempts: 1,
      maxAttempts: 3,
    } as never);
    mockedSendWhatsAppTemplate.mockRejectedValue(new Error('Meta timeout'));

    const result = await processNotificationJob('job-1', {
      now,
      config: getWhatsAppConfig({
        WHATSAPP_SEND_ENABLED: 'true',
        WHATSAPP_ACCESS_TOKEN: 'token',
        WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
        WHATSAPP_TEMPLATE_ORDER_RECEIVED: 'livneys_order_received_he',
      }),
    });

    expect(result).toEqual({ processed: true, status: 'PENDING' });
    expect(mockedNotificationJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'PENDING',
        nextAttemptAt: new Date('2026-07-01T10:05:00.000Z'),
        errorMessage: 'Meta timeout',
      }),
    });
  });

  it('stops retrying transient failures at max attempts', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    mockedNotificationJobUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockedNotificationJobFindUnique.mockResolvedValue({
      id: 'job-1',
      customerId: 'cust-001',
      reminderJobId: null,
      templateKey: 'ORDER_RECEIVED',
      templateName: 'livneys_order_received_he',
      payload: {
        to: '+972501234567',
        languageCode: 'he',
        bodyParameters: ['Dana', 'Cafe South'],
      },
      message: 'Preview message',
      attempts: 3,
      maxAttempts: 3,
    } as never);
    mockedSendWhatsAppTemplate.mockRejectedValue(new Error('Meta timeout'));

    const result = await processNotificationJob('job-1', {
      now,
      config: getWhatsAppConfig({
        WHATSAPP_SEND_ENABLED: 'true',
        WHATSAPP_ACCESS_TOKEN: 'token',
        WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
        WHATSAPP_TEMPLATE_ORDER_RECEIVED: 'livneys_order_received_he',
      }),
    });

    expect(result).toEqual({ processed: true, status: 'FAILED' });
    expect(mockedNotificationJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        nextAttemptAt: null,
        errorMessage: 'Meta timeout',
      }),
    });
  });

  it('marks permanent failures failed without scheduling retry', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    mockedNotificationJobUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockedNotificationJobFindUnique.mockResolvedValue({
      id: 'job-1',
      customerId: 'cust-001',
      reminderJobId: null,
      templateKey: 'ORDER_RECEIVED',
      templateName: null,
      payload: {
        to: '+972501234567',
        languageCode: 'he',
        bodyParameters: ['Dana', 'Cafe South'],
      },
      message: 'Preview message',
      attempts: 1,
      maxAttempts: 3,
    } as never);
    mockedSendWhatsAppTemplate.mockRejectedValue(new PermanentWhatsAppError('WhatsApp template is not configured for ORDER_RECEIVED'));

    const result = await processNotificationJob('job-1', {
      now,
      config: getWhatsAppConfig({
        WHATSAPP_SEND_ENABLED: 'true',
        WHATSAPP_ACCESS_TOKEN: 'token',
        WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
      }),
    });

    expect(result).toEqual({ processed: true, status: 'FAILED' });
    expect(mockedNotificationJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        nextAttemptAt: null,
        errorMessage: 'WhatsApp template is not configured for ORDER_RECEIVED',
      }),
    });
  });

  it('manual retry resets attempts and requeues immediately before processing', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    mockedNotificationJobUpdateMany.mockResolvedValue({ count: 0 } as never);

    await retryNotificationJob('job-1', {
      now,
      config: getWhatsAppConfig({ WHATSAPP_SEND_ENABLED: 'false' }),
    });

    expect(mockedNotificationJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: 'PENDING',
        dryRun: true,
        attempts: 0,
        scheduledAt: now,
        nextAttemptAt: now,
        lastAttemptAt: null,
        processedAt: null,
        providerMessageId: null,
        errorMessage: null,
      },
    });
  });

  it('sends a job now by requeueing it immediately before processing', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    mockedNotificationJobUpdateMany.mockResolvedValue({ count: 0 } as never);
    mockedNotificationJobFindUnique.mockResolvedValueOnce({
      id: 'job-1',
      templateKey: 'ORDER_RECEIVED',
      order: {
        id: 'ord-1',
        orderNumber: 1001,
        status: 'SUBMITTED',
        total: 123.5,
        totalIncludingVat: 145.73,
        deliveryWindowStart: new Date('2026-07-01T08:00:00.000Z'),
      },
      customer: {
        id: 'cust-001',
        name: 'Cafe South',
        contact: 'Dana',
        phone: '050-123-4567',
      },
    } as never);

    await sendNotificationJobNow('job-1', {
      now,
      config: getWhatsAppConfig({
        WHATSAPP_SEND_ENABLED: 'false',
        WHATSAPP_TEMPLATE_LANGUAGE: 'en_US',
        WHATSAPP_TEMPLATE_ORDER_RECEIVED: 'jaspers_market_order_confirmation_v1',
        NEXTAUTH_URL: 'https://orders.example.com',
      }),
    });

    expect(mockedNotificationJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: 'PENDING',
        dryRun: true,
        templateName: 'jaspers_market_order_confirmation_v1',
        attempts: 0,
        payload: {
          to: '+972501234567',
          languageCode: 'en_US',
          bodyParameters: [
            { name: 'customer_name', text: 'Dana' },
            { name: 'order_id', text: '#1001' },
            { name: 'delivery_date', text: '01/07/2026' },
          ],
        },
        message: 'Cafe South: ORDER_RECEIVED #1001 01/07/2026 ₪145.73',
        scheduledAt: now,
        nextAttemptAt: now,
        lastAttemptAt: null,
        processedAt: null,
        providerMessageId: null,
        errorMessage: null,
      },
    });
  });
});
