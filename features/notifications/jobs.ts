import type { NotificationChannel, NotificationJob, ReminderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AppError, NotFoundError } from '@/lib/errors';
import { getChannelStrategies, getChannelStrategy, type NotificationConfig, type NotificationRecipient } from './channels';
import { PermanentDeliveryError } from './delivery';
import type { NotificationContent } from './templates';

/**
 * Outbound messages are persisted as jobs first (outbox pattern) and then delivered. This keeps
 * business transactions independent of provider outages and gives the team a visible queue
 * with retries, failures and a manual "send now".
 */

const DEFAULT_MAX_ATTEMPTS = 3;

export async function enqueueNotification({
  customerId,
  recipient,
  content,
  dedupeKey,
  orderId = null,
  reminderJobId = null,
  channels,
  scheduledAt = new Date(),
  config,
}: {
  customerId: string;
  recipient: NotificationRecipient;
  content: NotificationContent;
  /** Stable per logical message; the channel is appended so each channel is sent at most once. */
  dedupeKey: string;
  orderId?: string | null;
  reminderJobId?: string | null;
  channels?: NotificationChannel[];
  scheduledAt?: Date;
  config?: NotificationConfig;
}): Promise<string[]> {
  const jobIds: string[] = [];

  for (const strategy of getChannelStrategies(config)) {
    if (channels && !channels.includes(strategy.channel)) continue;
    if (!strategy.isEnabled()) continue;
    const address = strategy.resolveAddress(recipient);
    if (!address) continue;

    const prepared = strategy.prepare(content, address);
    const key = `${dedupeKey}:${strategy.channel}`;
    const job = await prisma.notificationJob.upsert({
      where: { dedupeKey: key },
      create: {
        customerId,
        orderId,
        reminderJobId,
        channel: strategy.channel,
        templateKey: content.templateKey,
        templateName: prepared.templateName,
        status: 'PENDING',
        dryRun: prepared.dryRun,
        payload: prepared.payload,
        message: content.text,
        scheduledAt,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        dedupeKey: key,
      },
      update: {},
      select: { id: true },
    });
    jobIds.push(job.id);
  }

  return jobIds;
}

/** Atomically moves a due job to PROCESSING so two workers can never send it twice. */
async function claimJob(jobId: string, now: Date): Promise<NotificationJob | null> {
  const claimed = await prisma.notificationJob.updateMany({
    where: {
      id: jobId,
      status: 'PENDING',
      scheduledAt: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    data: { status: 'PROCESSING', lastAttemptAt: now, attempts: { increment: 1 }, errorMessage: null },
  });
  return claimed.count === 1 ? prisma.notificationJob.findUnique({ where: { id: jobId } }) : null;
}

export type ProcessResult = { processed: false } | { processed: true; status: 'SENT' | 'DRY_RUN' | 'PENDING' | 'FAILED' };

export async function processNotificationJob(jobId: string, { now = new Date(), config }: { now?: Date; config?: NotificationConfig } = {}): Promise<ProcessResult> {
  const job = await claimJob(jobId, now);
  if (!job) return { processed: false };

  let result: Awaited<ReturnType<ReturnType<typeof getChannelStrategy>['send']>>;
  try {
    result = await getChannelStrategy(job.channel, config).send(job);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unexpected notification failure';
    const finalFailure = error instanceof PermanentDeliveryError || job.attempts >= job.maxAttempts;
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: finalFailure ? 'FAILED' : 'PENDING',
        processedAt: now,
        nextAttemptAt: finalFailure ? null : getRetryTime(now, job.attempts),
        errorMessage,
      },
    });
    await recordOutcome(job, { status: 'FAILED', dryRun: job.dryRun, errorMessage, finalFailure, now });
    return { processed: true, status: finalFailure ? 'FAILED' : 'PENDING' };
  }

  // The provider accepted the message: from here on, never fall back to a retry (that would
  // send it twice). Bookkeeping failures are logged; the job stays PROCESSING for investigation.
  const dryRun = result.mode === 'dry-run';
  try {
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
    await recordOutcome(job, { status: 'SENT', dryRun, providerMessageId: result.providerMessageId, now });
  } catch (error) {
    console.error('Notification sent but its status could not be recorded', { jobId: job.id, error });
  }
  return { processed: true, status: dryRun ? 'DRY_RUN' : 'SENT' };
}

/** Delivers freshly queued jobs right away; failures stay queued for the cron retry. */
export async function deliverNow(jobIds: string[], config?: NotificationConfig): Promise<void> {
  await Promise.allSettled(jobIds.map((jobId) => processNotificationJob(jobId, { config })));
}

export async function processDueNotifications({
  now = new Date(),
  limit = 50,
  config,
}: { now?: Date; limit?: number; config?: NotificationConfig } = {}): Promise<{ processed: number }> {
  const due = await prisma.notificationJob.findMany({
    where: { status: 'PENDING', scheduledAt: { lte: now }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
    select: { id: true },
  });

  let processed = 0;
  for (const job of due) {
    const result = await processNotificationJob(job.id, { now, config });
    if (result.processed) processed += 1;
  }
  return { processed };
}

/** Admin "send now": re-queues a pending, failed or dry-run job and delivers it immediately. */
export async function resendNotificationJob(jobId: string, { now = new Date(), config }: { now?: Date; config?: NotificationConfig } = {}) {
  // Only messages that were not delivered may be sent again (never SENT or in-flight PROCESSING jobs).
  const requeued = await prisma.notificationJob.updateMany({
    where: { id: jobId, status: { in: ['PENDING', 'FAILED', 'DRY_RUN'] } },
    data: {
      status: 'PENDING',
      attempts: 0,
      scheduledAt: now,
      nextAttemptAt: now,
      lastAttemptAt: null,
      processedAt: null,
      providerMessageId: null,
      errorMessage: null,
    },
  });
  if (requeued.count !== 1) {
    const exists = await prisma.notificationJob.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!exists) throw new NotFoundError('ההודעה לא נמצאה.');
    throw new AppError('INVALID_STATE', 'ההודעה כבר נשלחה או נמצאת בשליחה.');
  }
  return processNotificationJob(jobId, { now, config });
}

/** Backoff: 5, 10, 20, 40, 60 minutes. */
function getRetryTime(now: Date, attempt: number): Date {
  const minutes = Math.min(60, 5 * 2 ** Math.max(0, attempt - 1));
  return new Date(now.getTime() + minutes * 60 * 1000);
}

async function recordOutcome(
  job: NotificationJob,
  outcome:
    | { status: 'SENT'; dryRun: boolean; providerMessageId: string | null; now: Date }
    | { status: 'FAILED'; dryRun: boolean; errorMessage: string; finalFailure: boolean; now: Date },
) {
  if (job.reminderJobId) {
    await prisma.reminderJob.update({
      where: { id: job.reminderJobId },
      data: {
        status: getReminderStatus(job.channel, outcome),
        sentAt: outcome.status === 'SENT' && !outcome.dryRun ? outcome.now : undefined,
        errorMessage: outcome.status === 'FAILED' ? outcome.errorMessage : null,
      },
    });
  }

  await prisma.notificationEvent.create({
    data: {
      customerId: job.customerId,
      notificationJobId: job.id,
      reminderJobId: job.reminderJobId,
      channel: job.channel,
      type: job.templateKey,
      status: outcome.status,
      message: job.message ?? job.templateKey,
      templateKey: job.templateKey,
      dryRun: outcome.dryRun,
      providerMessageId: outcome.status === 'SENT' ? outcome.providerMessageId : null,
      errorMessage: outcome.status === 'FAILED' ? outcome.errorMessage : null,
    },
  });
}

function getReminderStatus(
  channel: NotificationChannel,
  outcome: { status: 'SENT' | 'FAILED'; dryRun: boolean; finalFailure?: boolean },
): ReminderStatus {
  if (outcome.status === 'FAILED') return outcome.finalFailure ? 'FAILED' : 'PENDING';
  if (channel === 'EMAIL') return outcome.dryRun ? 'PENDING' : 'EMAIL_SENT';
  return outcome.dryRun ? 'WHATSAPP_QUEUED' : 'WHATSAPP_SENT';
}
