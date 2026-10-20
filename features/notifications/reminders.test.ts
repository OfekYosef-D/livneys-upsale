import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('./jobs', () => ({ enqueueNotification: vi.fn() }));

const { prisma } = await import('@/lib/db');
const { asMock } = await import('@/test/prisma-mock');
const { enqueueNotification } = await import('./jobs');
const { generateDueReminders } = await import('./reminders');
const db = asMock(prisma);
const mockedEnqueue = vi.mocked(enqueueNotification);

const deliveryAt = new Date('2026-07-02T05:00:00.000Z');
const cutoffAt = new Date('2026-06-30T15:00:00.000Z');
// 48h before delivery = 2026-06-30T05:00Z
const beforeLeadTime = new Date('2026-06-30T04:00:00.000Z');
const withinWindow = new Date('2026-06-30T10:00:00.000Z');
const afterCutoff = new Date('2026-06-30T16:00:00.000Z');

function customer(id: string) {
  return {
    id,
    name: `עסק ${id}`,
    contact: `איש קשר ${id}`,
    email: `${id}@example.com`,
    phone: '050-123-4567',
    isActive: true,
    notificationPreference: null,
  };
}

function route(id: string, customers = [customer(`${id}-c1`)]) {
  return {
    id,
    name: `קו ${id}`,
    isActive: true,
    nextDeliveryAt: deliveryAt,
    nextCutoffAt: cutoffAt,
    deliveryWeekday: 4,
    cutoffWeekday: 2,
    cutoffTime: '18:00',
    customers,
  };
}

function rule(overrides: Record<string, unknown> = {}) {
  return { id: 'rule-1', name: 'תזכורת', routeId: null, channel: 'EMAIL', hoursBeforeDelivery: 48, isActive: true, ...overrides };
}

type ReminderRow = { id: string; status: string; customerId: string; routeId: string };
let reminderRows: Map<string, ReminderRow>;

beforeEach(() => {
  db.$reset();
  mockedEnqueue.mockReset();
  mockedEnqueue.mockImplementation(async ({ dedupeKey }) => [`job-for-${dedupeKey}`]);
  reminderRows = new Map();
  db.order.findMany.mockResolvedValue([]);
  db.reminderJob.upsert.mockImplementation(async ({ where, create }: {
    where: { customerId_routeId_deliveryWindowStart_channel_reminderRuleId: Record<string, unknown> };
    create: ReminderRow;
  }) => {
    const key = JSON.stringify(where.customerId_routeId_deliveryWindowStart_channel_reminderRuleId);
    if (!reminderRows.has(key)) reminderRows.set(key, { ...create, id: `rem-${reminderRows.size + 1}` });
    return reminderRows.get(key)!;
  });
});

function setup(rules: unknown[], routes: unknown[]) {
  db.reminderRule.findMany.mockResolvedValue(rules);
  db.route.findMany.mockResolvedValue(routes);
}

describe('generateDueReminders', () => {
  it('does nothing before the rule lead time is reached', async () => {
    setup([rule()], [route('r1')]);

    await expect(generateDueReminders({ now: beforeLeadTime })).resolves.toEqual({ queued: 0, skipped: 0 });
    expect(db.reminderJob.upsert).not.toHaveBeenCalled();
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it('queues a reminder once the lead time is reached and before cut-off', async () => {
    setup([rule()], [route('r1')]);

    await expect(generateDueReminders({ now: withinWindow })).resolves.toEqual({ queued: 1, skipped: 0 });

    const [row] = [...reminderRows.values()];
    expect(row).toMatchObject({ customerId: 'r1-c1', routeId: 'r1', status: 'PENDING', reminderRuleId: 'rule-1', channel: 'EMAIL' });
    expect(mockedEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'r1-c1',
      reminderJobId: row.id,
      channels: ['EMAIL'],
      dedupeKey: `reminder:${row.id}`,
      scheduledAt: withinWindow,
      content: expect.objectContaining({ templateKey: 'ORDER_REMINDER' }),
    }));
    const { content } = mockedEnqueue.mock.calls[0][0];
    expect(content.text).toContain('קו r1');
    expect(content.text).toContain('/customer/r1-c1');
  });

  it('sends nothing after the cut-off has passed', async () => {
    setup([rule()], [route('r1')]);

    await expect(generateDueReminders({ now: afterCutoff })).resolves.toEqual({ queued: 0, skipped: 0 });
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it('skips customers who already ordered for the upcoming delivery', async () => {
    setup([rule()], [route('r1', [customer('ordered'), customer('waiting')])]);
    db.order.findMany.mockResolvedValue([{ customerId: 'ordered' }]);

    await expect(generateDueReminders({ now: withinWindow })).resolves.toEqual({ queued: 1, skipped: 1 });

    expect(db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deliveryWindowStart: deliveryAt, customerId: { in: ['ordered', 'waiting'] } }),
    }));
    const statuses = Object.fromEntries([...reminderRows.values()].map((row) => [row.customerId, row.status]));
    expect(statuses).toEqual({ ordered: 'SKIPPED_ORDER_EXISTS', waiting: 'PENDING' });
    expect(mockedEnqueue).toHaveBeenCalledOnce();
    expect(mockedEnqueue.mock.calls[0][0].customerId).toBe('waiting');
  });

  it('applies a global rule to every route and a route rule only to its route', async () => {
    setup(
      [rule({ id: 'global' }), rule({ id: 'only-r2', routeId: 'r2', channel: 'WHATSAPP' })],
      [route('r1'), route('r2')],
    );

    await generateDueReminders({ now: withinWindow });

    const calls = mockedEnqueue.mock.calls.map(([input]) => `${input.customerId}:${input.channels?.join()}`);
    expect(calls.sort()).toEqual(['r1-c1:EMAIL', 'r2-c1:EMAIL', 'r2-c1:WHATSAPP']);
  });

  it('ignores routes without matching rules or customers', async () => {
    setup([rule({ routeId: 'r1' })], [route('r1', []), route('r2')]);

    await expect(generateDueReminders({ now: withinWindow })).resolves.toEqual({ queued: 0, skipped: 0 });
    expect(db.order.findMany).not.toHaveBeenCalled();
  });

  it('does not re-queue a reminder that was already handled', async () => {
    setup([rule()], [route('r1')]);
    await generateDueReminders({ now: withinWindow });
    const [row] = [...reminderRows.values()];
    row.status = 'EMAIL_SENT';
    mockedEnqueue.mockClear();

    await expect(generateDueReminders({ now: withinWindow })).resolves.toEqual({ queued: 0, skipped: 1 });
    expect(mockedEnqueue).not.toHaveBeenCalled();
    expect(reminderRows.size).toBe(1);
  });

  it('counts a reminder as skipped when no channel can reach the customer', async () => {
    setup([rule()], [route('r1')]);
    mockedEnqueue.mockResolvedValue([]);

    await expect(generateDueReminders({ now: withinWindow })).resolves.toEqual({ queued: 0, skipped: 1 });
  });

  it('rolls a stale route anchor forward to the next weekly delivery', async () => {
    const staleRoute = {
      ...route('r1'),
      nextDeliveryAt: new Date(deliveryAt.getTime() - 7 * 24 * 3_600_000),
      nextCutoffAt: new Date(cutoffAt.getTime() - 7 * 24 * 3_600_000),
    };
    setup([rule()], [staleRoute]);

    await expect(generateDueReminders({ now: withinWindow })).resolves.toEqual({ queued: 1, skipped: 0 });
    const [row] = [...reminderRows.values()] as Array<ReminderRow & { deliveryWindowStart: Date }>;
    expect(row.deliveryWindowStart).toEqual(deliveryAt);
  });
});
