import { formatOrderNumber } from '../orders/order-number';
import { getWhatsAppConfig, resolveWhatsAppTemplateName, type WhatsAppTemplateKey } from '../notifications/config';
import { getEmailConfig } from '../notifications/email';
import { processNotificationJob } from '../notifications/jobs';
import { normalizePhoneToE164 } from '../notifications/phone';
import { prisma } from '../../lib/db';

type AdditionDecision = 'APPROVED' | 'REJECTED';

export async function enqueueOrderAdditionDecisionNotifications({
  requestId,
  decision,
}: {
  requestId: string;
  decision: AdditionDecision;
}): Promise<{ enqueued: number }> {
  const request = await prisma.orderAdditionRequest.findUnique({
    where: { id: requestId },
    include: {
      order: { select: { id: true, orderNumber: true } },
      customer: { include: { notificationPreference: true } },
    },
  });
  if (!request || request.status !== decision) return { enqueued: 0 };

  const orderNumber = formatOrderNumber(request.order.orderNumber);
  const reason = decision === 'REJECTED' && request.rejectionReason
    ? ` סיבת הדחייה: ${request.rejectionReason}.`
    : '';
  const message = decision === 'APPROVED'
    ? `בקשת התוספת להזמנה ${orderNumber} אושרה ונוספה להזמנה.`
    : `בקשת התוספת להזמנה ${orderNumber} נדחתה.${reason}`;
  const templateKey = decision === 'APPROVED' ? 'ORDER_ADDITION_APPROVED' : 'ORDER_ADDITION_REJECTED';
  const jobs: Promise<{ id: string }>[] = [];
  const emailConfig = getEmailConfig();
  const whatsappConfig = getWhatsAppConfig();

  if (request.customer.notificationPreference?.emailEnabled && request.customer.email) {
    const dedupeKey = `addition:${request.id}:${decision}:EMAIL`;
    jobs.push(prisma.notificationJob.upsert({
      where: { dedupeKey },
      create: {
        customerId: request.customer.id,
        orderId: request.order.id,
        channel: 'EMAIL',
        templateKey,
        templateName: null,
        status: 'PENDING',
        dryRun: !emailConfig.apiKey || !emailConfig.from,
        payload: {
          to: request.customer.email,
          subject: `עדכון בקשת תוספת להזמנה ${orderNumber}`,
          text: message,
        },
        message,
        dedupeKey,
      },
      update: {},
    }));
  }

  const phone = normalizePhoneToE164(request.customer.phone);
  if (request.customer.isActive && request.customer.notificationPreference?.whatsappEnabled && phone) {
    const dedupeKey = `addition:${request.id}:${decision}:WHATSAPP`;
    jobs.push(prisma.notificationJob.upsert({
      where: { dedupeKey },
      create: {
        customerId: request.customer.id,
        orderId: request.order.id,
        channel: 'WHATSAPP',
        templateKey,
        templateName: resolveWhatsAppTemplateName(templateKey as WhatsAppTemplateKey, whatsappConfig),
        status: 'PENDING',
        dryRun: !whatsappConfig.sendEnabled,
        payload: {
          to: phone,
          languageCode: whatsappConfig.templateLanguage,
          bodyParameters: decision === 'APPROVED'
            ? [request.customer.contact, orderNumber]
            : [request.customer.contact, orderNumber, request.rejectionReason || 'לא צוינה סיבה'],
        },
        message,
        dedupeKey,
      },
      update: {},
    }));
  }

  const queuedJobs = await Promise.all(jobs);
  await Promise.allSettled(queuedJobs.map((job) => processNotificationJob(job.id)));
  return { enqueued: queuedJobs.length };
}
