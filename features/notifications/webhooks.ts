import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { normalizePhoneToE164 } from './phone';

type WebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: WebhookStatus[];
        messages?: WebhookMessage[];
      };
    }>;
  }>;
};

type WebhookStatus = {
  id?: unknown;
  status?: unknown;
  timestamp?: unknown;
  errors?: unknown;
};

type WebhookMessage = {
  id?: unknown;
  from?: unknown;
  timestamp?: unknown;
  text?: {
    body?: unknown;
  };
};

export function verifyWhatsAppWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string | null): boolean {
  if (!appSecret) return true;
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const expectedDigest = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const expected = Buffer.from(`sha256=${expectedDigest}`, 'utf8');
  const actual = Buffer.from(signatureHeader, 'utf8');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function processWhatsAppWebhookPayload(payload: unknown, { now = new Date() }: { now?: Date } = {}): Promise<void> {
  const webhookPayload = parseWebhookPayload(payload);
  const changes = webhookPayload.entry?.flatMap((entry) => entry.changes ?? []) ?? [];

  for (const change of changes) {
    const value = change.value;
    if (!value) continue;

    for (const status of value.statuses ?? []) {
      await processStatus(status, webhookPayload, now);
    }

    for (const message of value.messages ?? []) {
      await processInboundMessage(message, webhookPayload, now);
    }
  }
}

async function processStatus(status: WebhookStatus, payload: WebhookPayload, now: Date): Promise<void> {
  const providerMessageId = typeof status.id === 'string' ? status.id : null;
  const providerStatus = typeof status.status === 'string' ? status.status : null;
  const timestamp = typeof status.timestamp === 'string' || typeof status.timestamp === 'number' ? String(status.timestamp) : 'unknown';

  if (!providerMessageId || !providerStatus) return;

  const job = await prisma.notificationJob.findFirst({
    where: { providerMessageId },
    select: { id: true, customerId: true },
  });
  const nextStatus = providerStatus === 'failed' ? 'FAILED' : 'SENT';

  if (job) {
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: nextStatus,
        providerMessageId,
        errorMessage: providerStatus === 'failed' ? getWebhookError(status.errors) : null,
      },
    });
  }

  await prisma.notificationEvent.updateMany({
    where: { providerMessageId },
    data: { providerStatus },
  });

  await createWebhookEvent({
    dedupeKey: `status:${providerMessageId}:${providerStatus}:${timestamp}`,
    kind: 'STATUS',
    providerMessageId,
    providerStatus,
    customerId: job?.customerId ?? null,
    notificationJobId: job?.id ?? null,
    payload,
    processedAt: now,
  });
}

async function processInboundMessage(message: WebhookMessage, payload: WebhookPayload, now: Date): Promise<void> {
  const providerMessageId = typeof message.id === 'string' ? message.id : null;
  const rawFrom = typeof message.from === 'string' ? message.from : null;
  const fromPhone = rawFrom ? normalizePhoneToE164(rawFrom) : null;
  const text = typeof message.text?.body === 'string' ? message.text.body.trim() : '';

  if (!providerMessageId || !fromPhone) return;

  const customer = await findCustomerByPhone(fromPhone);

  if (customer && text.length > 0) {
    await prisma.customerContactLog.create({
      data: {
        customerId: customer.id,
        channel: 'WHATSAPP',
        summary: text,
      },
    });
  }

  await createWebhookEvent({
    dedupeKey: `message:${providerMessageId}`,
    kind: 'MESSAGE',
    providerMessageId,
    fromPhone,
    customerId: customer?.id ?? null,
    notificationJobId: null,
    payload,
    processedAt: now,
  });
}

async function findCustomerByPhone(phone: string): Promise<{ id: string } | null> {
  const customers = await prisma.customer.findMany({
    select: { id: true, phone: true },
  });

  return customers.find((customer) => normalizePhoneToE164(customer.phone) === phone) ?? null;
}

async function createWebhookEvent(input: {
  dedupeKey: string;
  kind: string;
  providerMessageId: string;
  providerStatus?: string | null;
  fromPhone?: string | null;
  customerId?: string | null;
  notificationJobId?: string | null;
  payload: WebhookPayload;
  processedAt: Date;
}) {
  try {
    await prisma.whatsAppWebhookEvent.create({
      data: {
        dedupeKey: input.dedupeKey,
        kind: input.kind,
        providerMessageId: input.providerMessageId,
        providerStatus: input.providerStatus,
        fromPhone: input.fromPhone,
        customerId: input.customerId,
        notificationJobId: input.notificationJobId,
        payload: input.payload as Prisma.InputJsonValue,
        processedAt: input.processedAt,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }
}

function getWebhookError(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const firstError = value[0] as { title?: unknown; message?: unknown };
  if (typeof firstError.message === 'string') return firstError.message;
  if (typeof firstError.title === 'string') return firstError.title;
  return 'WhatsApp provider reported a failed message status';
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}

function parseWebhookPayload(payload: unknown): WebhookPayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  return payload as WebhookPayload;
}
