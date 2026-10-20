import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationConfig, NotificationRecipient } from './channels';
import { getWhatsAppConfig } from './config';
import { getEmailConfig } from './email';
import type { NotificationContent } from './templates';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());

const { prisma } = await import('@/lib/db');
const { asMock } = await import('@/test/prisma-mock');
const { enqueueNotification, processNotificationJob, processDueNotifications, resendNotificationJob, deliverNow } = await import('./jobs');
const db = asMock(prisma);

type Job = Record<string, unknown> & { id: string; status: string; attempts: number; maxAttempts: number };

/** Minimal in-memory notificationJob table that honours the claim conditions used by the outbox. */
function installJobStore() {
  const jobs = new Map<string, Job>();
  let sequence = 0;

  const isDue = (job: Job, now: Date) =>
    (job.scheduledAt as Date).getTime() <= now.getTime()
    && (job.nextAttemptAt == null || (job.nextAttemptAt as Date).getTime() <= now.getTime());

  db.notificationJob.upsert.mockImplementation(async ({ where, create }: { where: { dedupeKey: string }; create: Job }) => {
    const existing = [...jobs.values()].find((job) => job.dedupeKey === where.dedupeKey);
    if (existing) return { id: existing.id };
    const job: Job = { nextAttemptAt: null, ...create, attempts: 0, id: `job-${++sequence}` };
    jobs.set(job.id, job);
    return { id: job.id };
  });
  db.notificationJob.updateMany.mockImplementation(async ({ where, data }: {
    where: { id: string; status: string | { in: string[] }; scheduledAt?: { lte: Date } };
    data: Record<string, unknown>;
  }) => {
    const job = jobs.get(where.id);
    const statusMatches = typeof where.status === 'string' ? job?.status === where.status : where.status.in.includes(job?.status ?? '');
    if (!job || !statusMatches || (where.scheduledAt && !isDue(job, where.scheduledAt.lte))) return { count: 0 };
    const { attempts, ...rest } = data as { attempts: number | { increment: number } };
    Object.assign(job, rest, { attempts: typeof attempts === 'number' ? attempts : job.attempts + attempts.increment });
    return { count: 1 };
  });
  db.notificationJob.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    const job = jobs.get(where.id);
    return job ? { ...job } : null;
  });
  db.notificationJob.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const job = jobs.get(where.id)!;
    Object.assign(job, data);
    return { ...job };
  });
  db.notificationJob.findMany.mockImplementation(async ({ where }: { where: { scheduledAt: { lte: Date } } }) =>
    [...jobs.values()].filter((job) => job.status === 'PENDING' && isDue(job, where.scheduledAt.lte)).map((job) => ({ id: job.id })));

  return jobs;
}

const now = new Date('2026-07-01T10:00:00.000Z');
const emailDryRun: NotificationConfig = { email: getEmailConfig({}), whatsapp: getWhatsAppConfig({}) };
const emailLive: NotificationConfig = {
  email: getEmailConfig({ RESEND_API_KEY: 're_key', EMAIL_FROM: 'orders@example.com' }),
  whatsapp: getWhatsAppConfig({}),
};
const allLive: NotificationConfig = {
  email: emailLive.email,
  whatsapp: getWhatsAppConfig({
    WHATSAPP_SEND_ENABLED: 'true',
    WHATSAPP_ACCESS_TOKEN: 'token',
    WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
    WHATSAPP_TEMPLATE_ORDER_RECEIVED: 'order_received_he',
  }),
};

const recipient: NotificationRecipient = {
  isActive: true,
  email: 'client@example.com',
  phone: '050-123-4567',
  notificationPreference: { emailEnabled: true, whatsappEnabled: true },
};

const content: NotificationContent = {
  templateKey: 'ORDER_RECEIVED',
  subject: 'קיבלנו את הזמנה #1',
  text: 'שלום דנה',
  whatsappParameters: [{ name: 'customer_name', text: 'דנה' }],
};

function enqueue(config: NotificationConfig, overrides: Partial<Parameters<typeof enqueueNotification>[0]> = {}) {
  return enqueueNotification({ customerId: 'cust-001', recipient, content, dedupeKey: 'order:ord-1:ORDER_RECEIVED', orderId: 'ord-1', scheduledAt: now, config, ...overrides });
}

function stubFetch(...responses: Array<{ status: number; body?: unknown }>) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce({ ok: response.status < 300, status: response.status, json: async () => response.body ?? {} });
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

let jobs: Map<string, Job>;

beforeEach(() => {
  db.$reset();
  jobs = installJobStore();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('enqueueNotification', () => {
  it('creates only an email job while WhatsApp sending is disabled', async () => {
    const ids = await enqueue(emailDryRun);

    expect(ids).toHaveLength(1);
    expect(jobs.get(ids[0])).toMatchObject({
      channel: 'EMAIL',
      status: 'PENDING',
      dryRun: true,
      dedupeKey: 'order:ord-1:ORDER_RECEIVED:EMAIL',
      templateKey: 'ORDER_RECEIVED',
      maxAttempts: 3,
      message: 'שלום דנה',
      payload: { to: 'client@example.com', subject: content.subject, text: content.text },
    });
  });

  it('creates one job per enabled channel with a channel-specific dedupe key', async () => {
    const ids = await enqueue(allLive);

    expect([...jobs.values()].map((job) => [job.channel, job.dedupeKey, job.dryRun])).toEqual([
      ['EMAIL', 'order:ord-1:ORDER_RECEIVED:EMAIL', false],
      ['WHATSAPP', 'order:ord-1:ORDER_RECEIVED:WHATSAPP', false],
    ]);
    expect(jobs.get(ids[1])).toMatchObject({ templateName: 'order_received_he', payload: { to: '+972501234567', languageCode: 'he' } });
  });

  it('is idempotent for the same logical message', async () => {
    const first = await enqueue(allLive);
    const second = await enqueue(allLive);

    expect(second).toEqual(first);
    expect(jobs.size).toBe(2);
  });

  it('respects customer preferences and channel filters', async () => {
    const emailOnly = await enqueue(allLive, { recipient: { ...recipient, notificationPreference: { emailEnabled: true, whatsappEnabled: false } } });
    expect(emailOnly.map((id) => jobs.get(id)!.channel)).toEqual(['EMAIL']);

    const whatsappOnly = await enqueue(allLive, { dedupeKey: 'k2', channels: ['WHATSAPP'] });
    expect(whatsappOnly.map((id) => jobs.get(id)!.channel)).toEqual(['WHATSAPP']);

    const none = await enqueue(allLive, { dedupeKey: 'k3', recipient: { ...recipient, isActive: false } });
    expect(none).toEqual([]);
  });

  it('defaults to email on and WhatsApp off when the customer has no preferences', async () => {
    const ids = await enqueue(allLive, { recipient: { ...recipient, notificationPreference: null } });
    expect(ids.map((id) => jobs.get(id)!.channel)).toEqual(['EMAIL']);
  });
});

describe('processNotificationJob', () => {
  it('marks dry-run email jobs DRY_RUN and records an event', async () => {
    const [id] = await enqueue(emailDryRun);

    await expect(processNotificationJob(id, { now, config: emailDryRun })).resolves.toEqual({ processed: true, status: 'DRY_RUN' });

    expect(jobs.get(id)).toMatchObject({ status: 'DRY_RUN', dryRun: true, attempts: 1, processedAt: now, providerMessageId: null });
    expect(db.notificationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ notificationJobId: id, channel: 'EMAIL', status: 'SENT', dryRun: true, type: 'ORDER_RECEIVED' }),
    });
    expect(db.reminderJob.update).not.toHaveBeenCalled();
  });

  it('sends live email jobs and stores the provider id', async () => {
    const fetchMock = stubFetch({ status: 200, body: { id: 'email-001' } });
    const [id] = await enqueue(emailLive);

    await expect(processNotificationJob(id, { now, config: emailLive })).resolves.toEqual({ processed: true, status: 'SENT' });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(jobs.get(id)).toMatchObject({ status: 'SENT', dryRun: false, providerMessageId: 'email-001' });
    expect(db.notificationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'SENT', dryRun: false, providerMessageId: 'email-001' }),
    });
  });

  it('does not process a job that is not claimable', async () => {
    const [id] = await enqueue(emailDryRun);
    await processNotificationJob(id, { now, config: emailDryRun });

    await expect(processNotificationJob(id, { now, config: emailDryRun })).resolves.toEqual({ processed: false });
    await expect(processNotificationJob('missing', { now, config: emailDryRun })).resolves.toEqual({ processed: false });

    const [future] = await enqueue(emailDryRun, { dedupeKey: 'future', scheduledAt: new Date(now.getTime() + 60_000) });
    await expect(processNotificationJob(future, { now, config: emailDryRun })).resolves.toEqual({ processed: false });
    expect(db.notificationEvent.create).toHaveBeenCalledOnce();
  });

  it('sends only once when two processors race for the same job', async () => {
    const fetchMock = stubFetch({ status: 200, body: { id: 'email-001' } }, { status: 200, body: { id: 'email-002' } });
    const [id] = await enqueue(emailLive);

    const results = await Promise.all([
      processNotificationJob(id, { now, config: emailLive }),
      processNotificationJob(id, { now, config: emailLive }),
    ]);

    expect(results).toContainEqual({ processed: false });
    expect(results).toContainEqual({ processed: true, status: 'SENT' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('re-queues transient failures with backoff until max attempts, then fails', async () => {
    stubFetch({ status: 500 }, { status: 500 }, { status: 503 });
    const [id] = await enqueue(emailLive);

    await expect(processNotificationJob(id, { now, config: emailLive })).resolves.toEqual({ processed: true, status: 'PENDING' });
    expect(jobs.get(id)).toMatchObject({
      status: 'PENDING',
      attempts: 1,
      nextAttemptAt: new Date(now.getTime() + 5 * 60_000),
      errorMessage: expect.stringContaining('500'),
    });
    expect(db.notificationEvent.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ status: 'FAILED' }) });

    // Not due again before the backoff elapses.
    await expect(processNotificationJob(id, { now, config: emailLive })).resolves.toEqual({ processed: false });

    const second = new Date(now.getTime() + 5 * 60_000);
    await expect(processNotificationJob(id, { now: second, config: emailLive })).resolves.toEqual({ processed: true, status: 'PENDING' });
    expect(jobs.get(id)).toMatchObject({ attempts: 2, nextAttemptAt: new Date(second.getTime() + 10 * 60_000) });

    const third = new Date(second.getTime() + 10 * 60_000);
    await expect(processNotificationJob(id, { now: third, config: emailLive })).resolves.toEqual({ processed: true, status: 'FAILED' });
    expect(jobs.get(id)).toMatchObject({ status: 'FAILED', attempts: 3, nextAttemptAt: null });
  });

  it('fails permanent errors immediately without retry', async () => {
    stubFetch({ status: 422 });
    const [id] = await enqueue(emailLive);

    await expect(processNotificationJob(id, { now, config: emailLive })).resolves.toEqual({ processed: true, status: 'FAILED' });
    expect(jobs.get(id)).toMatchObject({ status: 'FAILED', attempts: 1, nextAttemptAt: null, errorMessage: expect.stringContaining('422') });
  });

  it('fails WhatsApp jobs permanently when the template is missing', async () => {
    const fetchMock = stubFetch();
    const config: NotificationConfig = { ...allLive, whatsapp: { ...allLive.whatsapp, templates: { ...allLive.whatsapp.templates, ORDER_RECEIVED: null } } };
    const [id] = await enqueue(config, { channels: ['WHATSAPP'] });

    await expect(processNotificationJob(id, { now, config })).resolves.toEqual({ processed: true, status: 'FAILED' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(jobs.get(id)).toMatchObject({ status: 'FAILED', errorMessage: expect.stringContaining('template') });
  });

  describe('reminder jobs', () => {
    const reminderContent: NotificationContent = { ...content, templateKey: 'ORDER_REMINDER' };

    it('marks the reminder EMAIL_SENT after a live email', async () => {
      stubFetch({ status: 200, body: { id: 'email-001' } });
      const [id] = await enqueue(emailLive, { content: reminderContent, reminderJobId: 'rem-1', orderId: null, dedupeKey: 'reminder:rem-1' });

      await processNotificationJob(id, { now, config: emailLive });

      expect(db.reminderJob.update).toHaveBeenCalledWith({
        where: { id: 'rem-1' },
        data: { status: 'EMAIL_SENT', sentAt: now, errorMessage: null },
      });
    });

    it('keeps the reminder PENDING after a dry-run email', async () => {
      const [id] = await enqueue(emailDryRun, { content: reminderContent, reminderJobId: 'rem-1', orderId: null, dedupeKey: 'reminder:rem-1' });

      await processNotificationJob(id, { now, config: emailDryRun });

      expect(db.reminderJob.update).toHaveBeenCalledWith({
        where: { id: 'rem-1' },
        data: { status: 'PENDING', sentAt: undefined, errorMessage: null },
      });
    });

    it('marks the reminder WHATSAPP_SENT after a live WhatsApp message', async () => {
      stubFetch({ status: 200, body: { messages: [{ id: 'wamid.1' }] } });
      const config: NotificationConfig = {
        ...allLive,
        whatsapp: { ...allLive.whatsapp, templates: { ...allLive.whatsapp.templates, ORDER_REMINDER: 'reminder_he' } },
      };
      const [id] = await enqueue(config, { content: reminderContent, reminderJobId: 'rem-1', orderId: null, dedupeKey: 'reminder:rem-1', channels: ['WHATSAPP'] });

      await processNotificationJob(id, { now, config });

      expect(db.reminderJob.update).toHaveBeenCalledWith({
        where: { id: 'rem-1' },
        data: { status: 'WHATSAPP_SENT', sentAt: now, errorMessage: null },
      });
    });

    it('marks the reminder FAILED on a final failure', async () => {
      stubFetch({ status: 400 });
      const [id] = await enqueue(emailLive, { content: reminderContent, reminderJobId: 'rem-1', orderId: null, dedupeKey: 'reminder:rem-1' });

      await processNotificationJob(id, { now, config: emailLive });

      expect(db.reminderJob.update).toHaveBeenCalledWith({
        where: { id: 'rem-1' },
        data: expect.objectContaining({ status: 'FAILED', errorMessage: expect.stringContaining('400') }),
      });
    });
  });
});

describe('processDueNotifications', () => {
  it('processes only due pending jobs and counts them', async () => {
    await enqueue(emailDryRun, { dedupeKey: 'a' });
    await enqueue(emailDryRun, { dedupeKey: 'b' });
    const [future] = await enqueue(emailDryRun, { dedupeKey: 'c', scheduledAt: new Date(now.getTime() + 3_600_000) });

    await expect(processDueNotifications({ now, config: emailDryRun })).resolves.toEqual({ processed: 2 });
    expect(jobs.get(future)!.status).toBe('PENDING');
    await expect(processDueNotifications({ now, config: emailDryRun })).resolves.toEqual({ processed: 0 });
  });
});

describe('deliverNow', () => {
  it('delivers every queued job and never throws', async () => {
    const ids = [...(await enqueue(emailDryRun, { dedupeKey: 'a' })), ...(await enqueue(emailDryRun, { dedupeKey: 'b' }))];
    db.notificationJob.updateMany.mockRejectedValueOnce(new Error('db down'));

    await expect(deliverNow(ids, emailDryRun)).resolves.toBeUndefined();
    expect(ids.map((id) => jobs.get(id)!.status)).toEqual(['PENDING', 'DRY_RUN']);
  });
});

describe('resendNotificationJob', () => {
  it('resets a failed job and delivers it immediately', async () => {
    stubFetch({ status: 422 }, { status: 200, body: { id: 'email-002' } });
    const [id] = await enqueue(emailLive);
    await processNotificationJob(id, { now, config: emailLive });
    expect(jobs.get(id)!.status).toBe('FAILED');

    const later = new Date(now.getTime() + 60_000);
    await expect(resendNotificationJob(id, { now: later, config: emailLive })).resolves.toEqual({ processed: true, status: 'SENT' });
    expect(jobs.get(id)).toMatchObject({ status: 'SENT', attempts: 1, errorMessage: null, providerMessageId: 'email-002', processedAt: later });
  });

  it('re-sends a dry-run job once the channel is configured', async () => {
    stubFetch({ status: 200, body: { id: 'email-003' } });
    const [id] = await enqueue(emailDryRun);
    await processNotificationJob(id, { now, config: emailDryRun });

    await expect(resendNotificationJob(id, { now, config: emailLive })).resolves.toEqual({ processed: true, status: 'SENT' });
  });

  it('refuses to send a delivered message again', async () => {
    stubFetch({ status: 200, body: { id: 'email-004' } });
    const [id] = await enqueue(emailLive);
    await processNotificationJob(id, { now, config: emailLive });
    await expect(resendNotificationJob(id, { now, config: emailLive })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('throws NotFoundError for an unknown job', async () => {
    await expect(resendNotificationJob('missing', { now, config: emailDryRun })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
