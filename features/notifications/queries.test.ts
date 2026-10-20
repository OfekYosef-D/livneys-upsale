import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationTemplateKeys } from './config';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());

const { prisma } = await import('@/lib/db');
const { asMock } = await import('@/test/prisma-mock');
const { getNotificationManagementData } = await import('./queries');
const db = asMock(prisma);

const envKeys = [
  'RESEND_API_KEY', 'EMAIL_FROM', 'WHATSAPP_SEND_ENABLED', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', ...notificationTemplateKeys.map((key) => `WHATSAPP_TEMPLATE_${key}`),
];

function job(overrides: Record<string, unknown>) {
  return {
    id: 'job-1',
    orderId: 'ord-1',
    channel: 'EMAIL',
    templateKey: 'ORDER_RECEIVED',
    status: 'DRY_RUN',
    dryRun: true,
    message: 'תצוגה מקדימה',
    scheduledAt: new Date('2026-07-01T10:00:00.000Z'),
    processedAt: new Date('2026-07-01T10:01:00.000Z'),
    attempts: 1,
    maxAttempts: 3,
    errorMessage: null,
    customer: { name: 'קפה דרום', contact: 'דנה', phone: '050-1234567', email: 'cafe@example.com' },
    order: { orderNumber: 1042 },
    ...overrides,
  };
}

describe('getNotificationManagementData', () => {
  beforeEach(() => {
    db.$reset();
    for (const key of envKeys) vi.stubEnv(key, '');
    db.notificationJob.findMany.mockResolvedValue([]);
    db.reminderRule.findMany.mockResolvedValue([]);
    db.route.findMany.mockResolvedValue([]);
    db.whatsAppWebhookEvent.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps jobs, reminder rules, routes and webhook events for the admin page', async () => {
    db.notificationJob.findMany.mockResolvedValue([
      job({}),
      job({ id: 'job-2', channel: 'WHATSAPP', orderId: null, order: null, processedAt: null, status: 'FAILED', errorMessage: 'boom' }),
    ]);
    db.reminderRule.findMany.mockResolvedValue([
      { id: 'rule-1', name: 'כללי', routeId: null, route: null, channel: 'EMAIL', hoursBeforeDelivery: 48, isActive: true },
      { id: 'rule-2', name: 'צפון', routeId: 'r1', route: { name: 'צפון' }, channel: 'WHATSAPP', hoursBeforeDelivery: 24, isActive: false },
    ]);
    db.route.findMany.mockResolvedValue([{ id: 'r1', name: 'צפון' }]);
    db.whatsAppWebhookEvent.findMany.mockResolvedValue([
      { id: 'evt-1', kind: 'STATUS', providerStatus: 'delivered', customer: { name: 'קפה דרום' }, fromPhone: '972501234567', errorMessage: null, receivedAt: new Date('2026-07-01T10:02:00.000Z') },
      { id: 'evt-2', kind: 'MESSAGE', providerStatus: null, customer: null, fromPhone: '972509999999', errorMessage: null, receivedAt: new Date('2026-07-01T10:03:00.000Z') },
      { id: 'evt-3', kind: 'UNKNOWN', providerStatus: null, customer: null, fromPhone: null, errorMessage: 'bad', receivedAt: new Date('2026-07-01T10:04:00.000Z') },
    ]);

    const data = await getNotificationManagementData();

    expect(data.jobs).toEqual([
      {
        id: 'job-1',
        channel: 'EMAIL',
        customerName: 'קפה דרום',
        recipient: 'cafe@example.com',
        orderId: 'ord-1',
        orderNumber: 1042,
        templateKey: 'ORDER_RECEIVED',
        status: 'DRY_RUN',
        dryRun: true,
        message: 'תצוגה מקדימה',
        scheduledAt: '2026-07-01T10:00:00.000Z',
        processedAt: '2026-07-01T10:01:00.000Z',
        attempts: 1,
        maxAttempts: 3,
        errorMessage: null,
      },
      expect.objectContaining({ id: 'job-2', recipient: '050-1234567', orderNumber: null, processedAt: null, errorMessage: 'boom' }),
    ]);
    expect(data.reminderRules).toEqual([
      { id: 'rule-1', name: 'כללי', routeId: null, routeName: null, channel: 'EMAIL', hoursBeforeDelivery: 48, isActive: true },
      { id: 'rule-2', name: 'צפון', routeId: 'r1', routeName: 'צפון', channel: 'WHATSAPP', hoursBeforeDelivery: 24, isActive: false },
    ]);
    expect(data.routes).toEqual([{ id: 'r1', name: 'צפון' }]);
    expect(data.webhookEvents.map((event) => event.customerName)).toEqual(['קפה דרום', '972509999999', null]);
    expect(data.webhookEvents[0]).toEqual({
      id: 'evt-1', kind: 'STATUS', providerStatus: 'delivered', customerName: 'קפה דרום', errorMessage: null, receivedAt: '2026-07-01T10:02:00.000Z',
    });
  });

  it('reports unconfigured channels', async () => {
    const { channels } = await getNotificationManagementData();

    expect(channels.email).toEqual({ configured: false, from: null });
    expect(channels.whatsapp).toEqual({
      enabled: false,
      providerConfigured: false,
      webhookConfigured: false,
      missingTemplates: [...notificationTemplateKeys],
    });
  });

  it('reports configured channels and only the missing templates', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_key');
    vi.stubEnv('EMAIL_FROM', 'orders@example.com');
    vi.stubEnv('WHATSAPP_SEND_ENABLED', 'true');
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token');
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', 'phone-id');
    vi.stubEnv('WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'verify');
    vi.stubEnv('WHATSAPP_APP_SECRET', 'secret');
    for (const key of notificationTemplateKeys) {
      if (key !== 'ORDER_PACKED') vi.stubEnv(`WHATSAPP_TEMPLATE_${key}`, `${key.toLowerCase()}_he`);
    }

    const { channels } = await getNotificationManagementData();

    expect(channels.email).toEqual({ configured: true, from: 'orders@example.com' });
    expect(channels.whatsapp).toEqual({ enabled: true, providerConfigured: true, webhookConfigured: true, missingTemplates: ['ORDER_PACKED'] });
  });
});
