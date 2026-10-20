import { prisma } from '@/lib/db';
import { hasWhatsAppProviderCredentials, notificationTemplateKeys } from './config';
import { loadNotificationConfig } from './channels';
import { isEmailConfigured } from './email';

export async function getNotificationManagementData() {
  const [jobs, reminderRules, routes, webhookEvents] = await Promise.all([
    prisma.notificationJob.findMany({
      include: {
        customer: { select: { name: true, contact: true, phone: true, email: true } },
        order: { select: { orderNumber: true } },
      },
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
      take: 150,
    }),
    prisma.reminderRule.findMany({
      include: { route: { select: { name: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.route.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.whatsAppWebhookEvent.findMany({
      include: { customer: { select: { name: true } } },
      orderBy: { receivedAt: 'desc' },
      take: 30,
    }),
  ]);
  const config = loadNotificationConfig();

  return {
    channels: {
      email: { configured: isEmailConfigured(config.email), from: config.email.from },
      whatsapp: {
        enabled: config.whatsapp.sendEnabled,
        providerConfigured: hasWhatsAppProviderCredentials(config.whatsapp),
        webhookConfigured: Boolean(config.whatsapp.webhookVerifyToken && config.whatsapp.appSecret),
        missingTemplates: notificationTemplateKeys.filter((key) => !config.whatsapp.templates[key]),
      },
    },
    jobs: jobs.map((job) => ({
      id: job.id,
      channel: job.channel,
      customerName: job.customer.name,
      recipient: job.channel === 'EMAIL' ? job.customer.email : job.customer.phone,
      orderId: job.orderId,
      orderNumber: job.order?.orderNumber ?? null,
      templateKey: job.templateKey,
      status: job.status,
      dryRun: job.dryRun,
      message: job.message,
      scheduledAt: job.scheduledAt.toISOString(),
      processedAt: job.processedAt?.toISOString() ?? null,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      errorMessage: job.errorMessage,
    })),
    reminderRules: reminderRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      routeId: rule.routeId,
      routeName: rule.route?.name ?? null,
      channel: rule.channel,
      hoursBeforeDelivery: rule.hoursBeforeDelivery,
      isActive: rule.isActive,
    })),
    routes,
    webhookEvents: webhookEvents.map((event) => ({
      id: event.id,
      kind: event.kind,
      providerStatus: event.providerStatus,
      customerName: event.customer?.name ?? event.fromPhone ?? null,
      errorMessage: event.errorMessage,
      receivedAt: event.receivedAt.toISOString(),
    })),
  };
}

export type NotificationManagementData = Awaited<ReturnType<typeof getNotificationManagementData>>;
