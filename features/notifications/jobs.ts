import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { OrderStatus } from '@/features/orders/utils';
import {
  getWhatsAppConfig,
  resolveWhatsAppTemplateName,
  type WhatsAppConfig,
  type WhatsAppTemplateKey,
} from './config';
import { normalizePhoneToE164 } from './phone';
import { PermanentWhatsAppError, sendWhatsAppTemplate, type WhatsAppTemplateBodyParameter } from './sender';
import {
  buildOrderTemplatePayload,
  buildReminderTemplatePayload,
  getTemplateKeyForOrderStatus,
} from './templates';

type EnqueueResult =
  | { enqueued: true; jobId: string }
  | { enqueued: false; reason: string };

type EligibleCustomer = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  isActive: boolean;
  notificationPreference: { whatsappEnabled: boolean } | null;
};

type NotificationJobPayload = {
  to: string;
  languageCode: string;
  bodyParameters: WhatsAppTemplateBodyParameter[];
};

export type ProcessNotificationJobResult =
  | { processed: true; status: 'DRY_RUN' | 'SENT' | 'PENDING' | 'FAILED' }
  | { processed: false; reason: 'not_claimed' };

const defaultBaseUrl = 'http://localhost:3000';

export async function enqueueOrderLifecycleWhatsApp({
  orderId,
  templateKey,
  config = getWhatsAppConfig(),
}: {
  orderId: string;
  templateKey?: WhatsAppTemplateKey;
  config?: WhatsAppConfig;
}): Promise<EnqueueResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        include: {
          notificationPreference: true,
        },
      },
    },
  });

  if (!order) {
    return { enqueued: false, reason: 'order_not_found' };
  }

  const resolvedTemplateKey = templateKey ?? getTemplateKeyForOrderStatus(order.status as OrderStatus);
  if (!resolvedTemplateKey) {
    return { enqueued: false, reason: 'no_template_for_status' };
  }

  const templateName = resolveWhatsAppTemplateName(resolvedTemplateKey, config);
  if (config.sendEnabled && !templateName) {
    return { enqueued: false, reason: 'template_not_configured' };
  }

  const eligibility = getWhatsAppEligibility(order.customer);
  if (!eligibility.eligible) {
    return { enqueued: false, reason: eligibility.reason };
  }

  const templatePayload = buildOrderTemplatePayload({
    templateKey: resolvedTemplateKey,
    baseUrl: config.baseUrl ?? defaultBaseUrl,
    customer: {
      id: order.customer.id,
      name: order.customer.name,
      contact: order.customer.contact,
    },
    order: {
      orderNumber: order.orderNumber,
      status: order.status as OrderStatus,
      totalIncludingVat: Number(order.totalIncludingVat),
      deliveryWindowStart: order.deliveryWindowStart,
    },
  });
  const dedupeKey = `order:${order.id}:${resolvedTemplateKey}`;
  const job = await prisma.notificationJob.upsert({
    where: { dedupeKey },
    create: {
      customerId: order.customer.id,
      orderId: order.id,
      channel: 'WHATSAPP',
      templateKey: resolvedTemplateKey,
      templateName,
      status: 'PENDING',
      dryRun: !config.sendEnabled,
      payload: {
        to: eligibility.phone,
        languageCode: config.templateLanguage,
        bodyParameters: templatePayload.bodyParameters,
      },
      message: templatePayload.previewMessage,
      scheduledAt: new Date(),
      dedupeKey,
    },
    update: {},
  });

  return { enqueued: true, jobId: job.id };
}

export async function claimNotificationJob(jobId: string, { now = new Date() }: { now?: Date } = {}) {
  const claimed = await prisma.notificationJob.updateMany({
    where: {
      id: jobId,
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

  if (claimed.count !== 1) {
    return null;
  }

  return prisma.notificationJob.findUnique({
    where: { id: jobId },
  });
}

export async function processNotificationJob(
  jobId: string,
  {
    now = new Date(),
    config = getWhatsAppConfig(),
  }: {
    now?: Date;
    config?: WhatsAppConfig;
  } = {},
): Promise<ProcessNotificationJobResult> {
  const job = await claimNotificationJob(jobId, { now });

  if (!job) {
    return { processed: false, reason: 'not_claimed' };
  }

  try {
    const payload = parseNotificationJobPayload(job.payload);
    const result = await sendWhatsAppTemplate(
      {
        to: payload.to,
        templateKey: job.templateKey as WhatsAppTemplateKey,
        templateName: job.templateName ?? resolveWhatsAppTemplateName(job.templateKey as WhatsAppTemplateKey, config),
        languageCode: payload.languageCode,
        bodyParameters: payload.bodyParameters,
      },
      { config },
    );
    const dryRun = result.mode === 'dry-run';

    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: dryRun ? 'DRY_RUN' : 'SENT',
        dryRun,
        processedAt: now,
        nextAttemptAt: null,
        providerMessageId: result.providerMessageId,
        errorMessage: null,
      },
    });

    if (job.reminderJobId) {
      await prisma.reminderJob.update({
        where: { id: job.reminderJobId },
        data: {
          status: dryRun ? 'WHATSAPP_QUEUED' : 'WHATSAPP_SENT',
          sentAt: dryRun ? undefined : now,
          errorMessage: null,
        },
      });
    }

    await prisma.notificationEvent.create({
      data: {
        customerId: job.customerId,
        notificationJobId: job.id,
        reminderJobId: job.reminderJobId,
        channel: 'WHATSAPP',
        type: job.templateKey,
        status: 'SENT',
        message: job.message ?? `${job.templateKey} WhatsApp notification`,
        templateKey: job.templateKey,
        dryRun,
        providerMessageId: result.providerMessageId,
      },
    });
    return { processed: true, status: dryRun ? 'DRY_RUN' : 'SENT' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected WhatsApp notification failure';
    const permanent = error instanceof PermanentWhatsAppError;
    const maxAttempts = job.maxAttempts ?? 3;
    const exhausted = job.attempts >= maxAttempts;
    const finalFailure = permanent || exhausted;
    const nextAttemptAt = finalFailure ? null : getNextAttemptAt(now, job.attempts);

    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: finalFailure ? 'FAILED' : 'PENDING',
        processedAt: now,
        nextAttemptAt,
        errorMessage: message,
      },
    });

    if (job.reminderJobId) {
      await prisma.reminderJob.update({
        where: { id: job.reminderJobId },
        data: {
          status: finalFailure ? 'FAILED' : 'PENDING',
          errorMessage: message,
        },
      });
    }

    await prisma.notificationEvent.create({
      data: {
        customerId: job.customerId,
        notificationJobId: job.id,
        reminderJobId: job.reminderJobId,
        channel: 'WHATSAPP',
        type: job.templateKey,
        status: 'FAILED',
        message: job.message ?? `${job.templateKey} WhatsApp notification`,
        templateKey: job.templateKey,
        dryRun: !config.sendEnabled,
        errorMessage: message,
      },
    });
    return { processed: true, status: finalFailure ? 'FAILED' : 'PENDING' };
  }
}

export async function processDueNotifications({
  now = new Date(),
  limit = 25,
  config = getWhatsAppConfig(),
}: {
  now?: Date;
  limit?: number;
  config?: WhatsAppConfig;
} = {}): Promise<{ processed: number }> {
  await generateDueReminderNotifications({ now, config });

  const jobs = await prisma.notificationJob.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      channel: 'WHATSAPP',
    },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
    select: { id: true },
  });

  let processed = 0;
  for (const job of jobs) {
    const result = await processNotificationJob(job.id, { now, config });
    if (result.processed) {
      processed += 1;
    }
  }

  return { processed };
}

export async function generateDueReminderNotifications({
  now = new Date(),
  config = getWhatsAppConfig(),
}: {
  now?: Date;
  config?: WhatsAppConfig;
} = {}): Promise<{ created: number; skipped: number }> {
  const rules = await prisma.reminderRule.findMany({
    where: {
      isActive: true,
      channel: 'WHATSAPP',
    },
    include: {
      route: {
        include: {
          customers: {
            where: { isActive: true },
            include: {
              notificationPreference: true,
              orders: {
                where: {
                  status: { in: ['DRAFT', 'SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED', 'PACKED'] },
                },
                select: { id: true, deliveryWindowStart: true },
              },
            },
          },
        },
      },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const rule of rules) {
    if (!rule.route || !rule.route.isActive) continue;

    const scheduledAt = new Date(rule.route.nextDeliveryAt.getTime() - rule.hoursBeforeDelivery * 60 * 60 * 1000);
    if (scheduledAt.getTime() > now.getTime()) continue;

    for (const customer of rule.route.customers) {
      const hasOrder = customer.orders.some((order) => order.deliveryWindowStart.getTime() === rule.route!.nextDeliveryAt.getTime());
      const reminderJob = await prisma.reminderJob.upsert({
        where: {
          customerId_routeId_deliveryWindowStart_channel_reminderRuleId: {
            customerId: customer.id,
            routeId: rule.route.id,
            deliveryWindowStart: rule.route.nextDeliveryAt,
            channel: 'WHATSAPP',
            reminderRuleId: rule.id,
          },
        },
        create: {
          reminderRuleId: rule.id,
          customerId: customer.id,
          routeId: rule.route.id,
          deliveryWindowStart: rule.route.nextDeliveryAt,
          channel: 'WHATSAPP',
          status: hasOrder ? 'SKIPPED_ORDER_EXISTS' : 'PENDING',
          scheduledAt,
        },
        update: {},
      });

      if (hasOrder) {
        skipped += 1;
        continue;
      }

      const eligibility = getWhatsAppEligibility(customer);
      if (!eligibility.eligible) {
        skipped += 1;
        continue;
      }

      const templatePayload = buildReminderTemplatePayload({
        baseUrl: config.baseUrl ?? defaultBaseUrl,
        customer,
        route: {
          name: rule.route.name,
          nextDeliveryAt: rule.route.nextDeliveryAt,
          nextCutoffAt: rule.route.nextCutoffAt,
        },
      });
      const templateKey = 'ORDER_REMINDER' satisfies WhatsAppTemplateKey;
      const templateName = resolveWhatsAppTemplateName(templateKey, config);
      if (config.sendEnabled && !templateName) {
        skipped += 1;
        continue;
      }

      const dedupeKey = `reminder:${reminderJob.id}:${templateKey}`;
      await prisma.notificationJob.upsert({
        where: { dedupeKey },
        create: {
          customerId: customer.id,
          reminderJobId: reminderJob.id,
          channel: 'WHATSAPP',
          templateKey,
          templateName,
          status: 'PENDING',
          dryRun: !config.sendEnabled,
          payload: {
        to: eligibility.phone,
        languageCode: config.templateLanguage,
        bodyParameters: templatePayload.bodyParameters,
      },
          message: templatePayload.previewMessage,
          scheduledAt,
          dedupeKey,
        },
        update: {},
      });
      created += 1;
    }
  }

  return { created, skipped };
}

export async function retryNotificationJob(jobId: string, { now = new Date(), config = getWhatsAppConfig() } = {}) {
  await prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      status: 'PENDING',
      dryRun: !config.sendEnabled,
      attempts: 0,
      scheduledAt: now,
      nextAttemptAt: now,
      lastAttemptAt: null,
      processedAt: null,
      providerMessageId: null,
      errorMessage: null,
    },
  });

  await processNotificationJob(jobId, { now, config });
}

export async function sendNotificationJobNow(jobId: string, { now = new Date(), config = getWhatsAppConfig() } = {}) {
  const refreshedData = await buildRefreshedNotificationJobData(jobId, config);

  await prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      status: 'PENDING',
      dryRun: !config.sendEnabled,
      ...refreshedData,
      attempts: 0,
      scheduledAt: now,
      nextAttemptAt: now,
      lastAttemptAt: null,
      processedAt: null,
      providerMessageId: null,
      errorMessage: null,
    },
  });

  await processNotificationJob(jobId, { now, config });
}

async function buildRefreshedNotificationJobData(jobId: string, config: WhatsAppConfig): Promise<{
  templateName?: string | null;
  payload?: NotificationJobPayload;
  message?: string;
}> {
  const job = await prisma.notificationJob.findUnique({
    where: { id: jobId },
    include: {
      order: true,
      customer: {
        select: {
          id: true,
          name: true,
          contact: true,
          phone: true,
        },
      },
    },
  });

  if (!job?.order) {
    return {};
  }

  const templateKey = job.templateKey as WhatsAppTemplateKey;
  const phone = normalizePhoneToE164(job.customer.phone);
  if (!phone) {
    return {};
  }

  const templatePayload = buildOrderTemplatePayload({
    templateKey,
    baseUrl: config.baseUrl ?? defaultBaseUrl,
    customer: {
      id: job.customer.id,
      name: job.customer.name,
      contact: job.customer.contact,
    },
    order: {
      orderNumber: job.order.orderNumber,
      status: job.order.status as OrderStatus,
      totalIncludingVat: Number(job.order.totalIncludingVat),
      deliveryWindowStart: job.order.deliveryWindowStart,
    },
  });

  return {
    templateName: resolveWhatsAppTemplateName(templateKey, config),
    payload: {
      to: phone,
      languageCode: config.templateLanguage,
      bodyParameters: templatePayload.bodyParameters,
    },
    message: templatePayload.previewMessage,
  };
}

function getNextAttemptAt(now: Date, attempt: number): Date {
  const retryMinutes = Math.min(60, 5 * 2 ** Math.max(0, attempt - 1));
  return new Date(now.getTime() + retryMinutes * 60 * 1000);
}

function getWhatsAppEligibility(customer: EligibleCustomer): { eligible: true; phone: string } | { eligible: false; reason: string } {
  if (!customer.isActive) {
    return { eligible: false, reason: 'inactive_customer' };
  }

  if (!customer.notificationPreference?.whatsappEnabled) {
    return { eligible: false, reason: 'whatsapp_disabled' };
  }

  const phone = normalizePhoneToE164(customer.phone);
  if (!phone) {
    return { eligible: false, reason: 'invalid_phone' };
  }

  return { eligible: true, phone };
}

function parseNotificationJobPayload(value: Prisma.JsonValue): NotificationJobPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Notification job payload is invalid');
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.to !== 'string' || typeof payload.languageCode !== 'string' || !Array.isArray(payload.bodyParameters)) {
    throw new Error('Notification job payload is missing WhatsApp template data');
  }

  return {
    to: payload.to,
    languageCode: payload.languageCode,
    bodyParameters: payload.bodyParameters.map(parseBodyParameter),
  };
}

function parseBodyParameter(value: unknown): WhatsAppTemplateBodyParameter {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return String(value);
  }

  const parameter = value as Record<string, unknown>;
  if (typeof parameter.name === 'string' && typeof parameter.text === 'string') {
    return {
      name: parameter.name,
      text: parameter.text,
    };
  }

  return String(value);
}
