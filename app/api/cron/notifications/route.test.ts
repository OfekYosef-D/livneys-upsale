import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('../../../../features/notifications/jobs', () => ({
  processDueNotifications: vi.fn(),
}));

const { processDueNotifications } = await import('../../../../features/notifications/jobs');
const mockedProcessDueNotifications = vi.mocked(processDueNotifications);

describe('/api/cron/notifications', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret';
    mockedProcessDueNotifications.mockReset();
    mockedProcessDueNotifications.mockResolvedValue({ processed: 2 });
  });

  it('rejects requests without the configured bearer secret', async () => {
    const response = await GET(new Request('https://orders.example.com/api/cron/notifications'));

    expect(response.status).toBe(401);
    expect(mockedProcessDueNotifications).not.toHaveBeenCalled();
  });

  it('processes due notifications when authorized', async () => {
    const response = await GET(
      new Request('https://orders.example.com/api/cron/notifications', {
        headers: { Authorization: 'Bearer cron-secret' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, processed: 2 });
    expect(mockedProcessDueNotifications).toHaveBeenCalledOnce();
  });
});
