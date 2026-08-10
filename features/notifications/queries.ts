import { prisma } from '@/lib/db';
import {
  getWhatsAppConfig,
  hasWhatsAppProviderCredentials,
  whatsappTemplateKeys,
} from './config';

export async function getNotificationManagementData() {
  const [jobs, webhookEvents, reminderRules] = await Promise.all([
    prisma.notificationJob.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            contact: true,
            phone: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            totalIncludingVat: true,
          },
        },
        reminderJob: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    }),
    prisma.whatsAppWebhookEvent.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    }),
    prisma.reminderRule.findMany({
      where: { channel: 'WHATSAPP' },
      include: {
        route: {
          select: {
            id: true,
            name: true,
            region: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
  ]);
  const config = getWhatsAppConfig();

  return {
    config: {
      sendEnabled: config.sendEnabled,
      providerConfigured: hasWhatsAppProviderCredentials(config),
      webhookConfigured: Boolean(config.webhookVerifyToken),
      missingTemplates: whatsappTemplateKeys.filter((key) => !config.templates[key]),
    },
    summary: {
      total: jobs.length,
      pending: jobs.filter((job) => job.status === 'PENDING').length,
      processing: jobs.filter((job) => job.status === 'PROCESSING').length,
      dryRun: jobs.filter((job) => job.status === 'DRY_RUN').length,
      sent: jobs.filter((job) => job.status === 'SENT').length,
      failed: jobs.filter((job) => job.status === 'FAILED').length,
    },
    jobs: jobs.map((job) => ({
      id: job.id,
      customerId: job.customerId,
      customerName: job.customer.name,
      customerContact: job.customer.contact,
      customerPhone: job.customer.phone,
      orderId: job.orderId,
      orderNumber: job.order?.orderNumber ?? null,
      orderStatus: job.order?.status ?? null,
      orderTotal: job.order ? Number(job.order.totalIncludingVat) : null,
      reminderJobId: job.reminderJobId,
      reminderStatus: job.reminderJob?.status ?? null,
      channel: job.channel,
      templateKey: job.templateKey,
      templateName: job.templateName,
      status: job.status,
      dryRun: job.dryRun,
      message: job.message,
      scheduledAt: job.scheduledAt.toISOString(),
      nextAttemptAt: job.nextAttemptAt?.toISOString() ?? null,
      lastAttemptAt: job.lastAttemptAt?.toISOString() ?? null,
      processedAt: job.processedAt?.toISOString() ?? null,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      providerMessageId: job.providerMessageId,
      errorMessage: job.errorMessage,
    })),
    webhookEvents: webhookEvents.map((event) => ({
      id: event.id,
      kind: event.kind,
      providerStatus: event.providerStatus,
      providerMessageId: event.providerMessageId,
      fromPhone: event.fromPhone,
      customerId: event.customerId,
      customerName: event.customer?.name ?? null,
      errorMessage: event.errorMessage,
      receivedAt: event.receivedAt.toISOString(),
    })),
    reminderRules: reminderRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      routeId: rule.routeId,
      routeName: rule.route?.name ?? null,
      routeRegion: rule.route?.region ?? null,
      channel: rule.channel,
      hoursBeforeDelivery: rule.hoursBeforeDelivery,
      isActive: rule.isActive,
    })),
  };
}
