import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('../../../features/deployment/health', () => ({
  checkApplicationHealth: vi.fn(),
}));

const { checkApplicationHealth } = await import('../../../features/deployment/health');
const mockedCheckApplicationHealth = vi.mocked(checkApplicationHealth);

describe('/api/health', () => {
  beforeEach(() => mockedCheckApplicationHealth.mockReset());

  it('returns 200 when the application and database are healthy', async () => {
    mockedCheckApplicationHealth.mockResolvedValue({ ok: true });
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('returns 503 without internal details when the database is unavailable', async () => {
    mockedCheckApplicationHealth.mockResolvedValue({ ok: false });
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
