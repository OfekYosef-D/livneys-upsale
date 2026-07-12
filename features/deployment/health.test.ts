import { describe, expect, it, vi } from 'vitest';
import { checkApplicationHealth } from './health';

describe('checkApplicationHealth', () => {
  it('reports healthy after a successful database probe', async () => {
    await expect(checkApplicationHealth(vi.fn().mockResolvedValue([{ ok: 1 }]))).resolves.toEqual({ ok: true });
  });

  it('reports unavailable without exposing the database error', async () => {
    await expect(checkApplicationHealth(vi.fn().mockRejectedValue(new Error('postgresql://secret')))).resolves.toEqual({ ok: false });
  });
});
