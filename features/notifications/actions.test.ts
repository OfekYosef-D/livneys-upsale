import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '@/lib/errors';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/authorization', () => ({ assertAdminAction: vi.fn(), assertCustomerAction: vi.fn() }));
vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('./jobs', () => ({ resendNotificationJob: vi.fn() }));

const { prisma } = await import('@/lib/db');
const { asMock } = await import('@/test/prisma-mock');
const { assertAdminAction } = await import('@/lib/authorization');
const { revalidatePath } = await import('next/cache');
const { resendNotificationJob } = await import('./jobs');
const { createReminderRuleAction, sendNotificationJobNowAction, updateReminderRuleAction } = await import('./actions');

const db = asMock(prisma);
const mockedAssertAdmin = vi.mocked(assertAdminAction);
const mockedResend = vi.mocked(resendNotificationJob);

const ruleInput = { name: ' תזכורת שבועית ', routeId: 'route-1', channel: 'WHATSAPP', hoursBeforeDelivery: '36', isActive: true };

beforeEach(() => {
  db.$reset();
  vi.mocked(revalidatePath).mockReset();
  mockedResend.mockReset();
  mockedAssertAdmin.mockReset();
  mockedAssertAdmin.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never);
  db.route.findUnique.mockResolvedValue({ id: 'route-1' });
});

describe('admin authorization', () => {
  it.each([
    ['sendNotificationJobNowAction', () => sendNotificationJobNowAction({ jobId: 'job-1' })],
    ['createReminderRuleAction', () => createReminderRuleAction(ruleInput)],
    ['updateReminderRuleAction', () => updateReminderRuleAction({ ...ruleInput, ruleId: 'rule-1' })],
  ])('%s rejects non-admins without side effects', async (_name, run) => {
    mockedAssertAdmin.mockRejectedValue(new AuthorizationError());

    await expect(run()).resolves.toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(mockedResend).not.toHaveBeenCalled();
    expect(db.reminderRule.create).not.toHaveBeenCalled();
    expect(db.reminderRule.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('sendNotificationJobNowAction', () => {
  it('re-sends the job and returns its new status', async () => {
    mockedResend.mockResolvedValue({ processed: true, status: 'SENT' });

    await expect(sendNotificationJobNowAction({ jobId: 'job-1' })).resolves.toEqual({ ok: true, data: { jobId: 'job-1', status: 'SENT' } });
    expect(mockedResend).toHaveBeenCalledWith('job-1');
    expect(revalidatePath).toHaveBeenCalled();
  });

  it('reports PENDING when the job could not be claimed', async () => {
    mockedResend.mockResolvedValue({ processed: false });

    await expect(sendNotificationJobNowAction({ jobId: 'job-1' })).resolves.toEqual({ ok: true, data: { jobId: 'job-1', status: 'PENDING' } });
  });

  it('validates the job id', async () => {
    await expect(sendNotificationJobNowAction({ jobId: '  ' })).resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(mockedResend).not.toHaveBeenCalled();
  });
});

describe('createReminderRuleAction', () => {
  it('creates the rule and writes an audit entry in the same transaction', async () => {
    db.reminderRule.create.mockResolvedValue({ id: 'rule-9' });

    await expect(createReminderRuleAction(ruleInput)).resolves.toEqual({ ok: true, data: { ruleId: 'rule-9' } });

    const expectedData = { name: 'תזכורת שבועית', routeId: 'route-1', channel: 'WHATSAPP', hoursBeforeDelivery: 36, isActive: true };
    expect(db.reminderRule.create).toHaveBeenCalledWith(expect.objectContaining({ data: expectedData }));
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        actorRole: 'ADMIN',
        entityType: 'ReminderRule',
        entityId: 'rule-9',
        action: 'REMINDER_RULE_CREATED',
        after: expectedData,
      }),
    });
  });

  it('allows a rule for all routes without checking a route', async () => {
    db.reminderRule.create.mockResolvedValue({ id: 'rule-10' });

    await expect(createReminderRuleAction({ ...ruleInput, routeId: '' })).resolves.toMatchObject({ ok: true });
    expect(db.route.findUnique).not.toHaveBeenCalled();
    expect(db.reminderRule.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ routeId: null }) }));
  });

  it('rejects an unknown route', async () => {
    db.route.findUnique.mockResolvedValue(null);

    await expect(createReminderRuleAction(ruleInput)).resolves.toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(db.reminderRule.create).not.toHaveBeenCalled();
  });

  it.each([
    ['lead time below one hour', { hoursBeforeDelivery: 0 }],
    ['lead time above 30 days', { hoursBeforeDelivery: 721 }],
    ['unknown channel', { channel: 'SMS' }],
    ['missing name', { name: '  ' }],
  ])('rejects %s', async (_label, overrides) => {
    await expect(createReminderRuleAction({ ...ruleInput, ...overrides })).resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(db.reminderRule.create).not.toHaveBeenCalled();
  });
});

describe('updateReminderRuleAction', () => {
  it('updates the rule and audits before/after', async () => {
    const before = { id: 'rule-1', name: 'ישן', routeId: null, channel: 'EMAIL', hoursBeforeDelivery: 48, isActive: true };
    db.reminderRule.findUnique.mockResolvedValue(before);

    await expect(updateReminderRuleAction({ ...ruleInput, ruleId: 'rule-1', isActive: false }))
      .resolves.toEqual({ ok: true, data: { ruleId: 'rule-1' } });

    const expectedData = { name: 'תזכורת שבועית', routeId: 'route-1', channel: 'WHATSAPP', hoursBeforeDelivery: 36, isActive: false };
    expect(db.reminderRule.update).toHaveBeenCalledWith({ where: { id: 'rule-1' }, data: expectedData });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityId: 'rule-1', action: 'REMINDER_RULE_UPDATED', before: expect.objectContaining({ id: 'rule-1', name: 'ישן', hoursBeforeDelivery: 48 }), after: expectedData }),
    });
  });

  it('returns NOT_FOUND for a missing rule without writing', async () => {
    db.reminderRule.findUnique.mockResolvedValue(null);

    await expect(updateReminderRuleAction({ ...ruleInput, ruleId: 'missing' })).resolves.toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(db.reminderRule.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
