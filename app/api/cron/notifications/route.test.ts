import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/notifications/jobs', () => ({ processDueNotifications: vi.fn() }));
vi.mock('@/features/notifications/reminders', () => ({ generateDueReminders: vi.fn() }));
vi.mock('@/features/routes/service', () => ({ advanceRouteSchedules: vi.fn() }));

const { processDueNotifications } = await import('@/features/notifications/jobs');
const { generateDueReminders } = await import('@/features/notifications/reminders');
const { advanceRouteSchedules } = await import('@/features/routes/service');
const { GET, POST } = await import('./route');

const mockedProcess = vi.mocked(processDueNotifications);
const mockedReminders = vi.mocked(generateDueReminders);
const mockedAdvance = vi.mocked(advanceRouteSchedules);

const url = 'https://orders.example.com/api/cron/notifications';

function request(authorization?: string, method = 'GET') {
  return new Request(url, { method, headers: authorization ? { Authorization: authorization } : {} });
}

describe('/api/cron/notifications', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    mockedProcess.mockReset().mockResolvedValue({ processed: 2 });
    mockedReminders.mockReset().mockResolvedValue({ queued: 3, skipped: 1 });
    mockedAdvance.mockReset().mockResolvedValue({ advanced: 1 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function expectNothingRan() {
    expect(mockedAdvance).not.toHaveBeenCalled();
    expect(mockedReminders).not.toHaveBeenCalled();
    expect(mockedProcess).not.toHaveBeenCalled();
  }

  it('returns 503 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '  ');

    const response = await GET(request('Bearer '));

    expect(response.status).toBe(503);
    expectNothingRan();
  });

  it.each([
    ['missing', undefined],
    ['wrong secret', 'Bearer wrong-secret'],
    ['wrong scheme', 'Basic cron-secret'],
    ['prefix of the secret', 'Bearer cron-secre'],
  ])('rejects a %s authorization header with 401', async (_label, header) => {
    const response = await GET(request(header));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Unauthorized' });
    expectNothingRan();
  });

  it('advances routes, generates reminders and delivers notifications when authorized', async () => {
    const response = await GET(request('Bearer cron-secret'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      routes: { advanced: 1 },
      reminders: { queued: 3, skipped: 1 },
      delivery: { processed: 2 },
    });

    const now = mockedAdvance.mock.calls[0][0];
    expect(now).toBeInstanceOf(Date);
    expect(mockedReminders).toHaveBeenCalledWith({ now });
    expect(mockedProcess).toHaveBeenCalledWith({ now });
    expect(mockedAdvance.mock.invocationCallOrder[0]).toBeLessThan(mockedReminders.mock.invocationCallOrder[0]);
    expect(mockedReminders.mock.invocationCallOrder[0]).toBeLessThan(mockedProcess.mock.invocationCallOrder[0]);
  });

  it('accepts POST as well', async () => {
    const response = await POST(request('Bearer cron-secret', 'POST'));
    expect(response.status).toBe(200);
    expect(mockedProcess).toHaveBeenCalledOnce();
  });
});
