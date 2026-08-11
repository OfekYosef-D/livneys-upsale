import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryRaw = vi.hoisted(() => vi.fn());
const deleteMany = vi.hoisted(() => vi.fn());
vi.mock('../../lib/db', () => ({ prisma: { $queryRaw: queryRaw, rateLimitBucket: { deleteMany } } }));

const { consumeRateLimit, clearRateLimit, RateLimitError } = await import('./rate-limit');

describe('authentication rate limiting', () => {
  beforeEach(() => { queryRaw.mockReset(); deleteMany.mockReset(); });

  it('returns remaining attempts from the atomic database counter', async () => {
    queryRaw.mockResolvedValue([{ count: 2, blockedUntil: null }]);
    await expect(consumeRateLimit({ scope: 'login-account', identifier: 'Email@example.com', limit: 8, windowMs: 1000 })).resolves.toMatchObject({ remaining: 6 });
  });

  it('surfaces a safe RATE_LIMITED error once blocked', async () => {
    queryRaw.mockResolvedValue([{ count: 9, blockedUntil: new Date(Date.now() + 60_000) }]);
    const promise = consumeRateLimit({ scope: 'login-account', identifier: 'same', limit: 8, windowMs: 1000 });
    await expect(promise).rejects.toBeInstanceOf(RateLimitError);
    await expect(promise).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('clears only the hashed scoped key after successful login', async () => {
    await clearRateLimit('login-account', 'Sensitive@Example.com');
    expect(deleteMany).toHaveBeenCalledWith({ where: { key: expect.stringMatching(/^login-account:[a-f0-9]{64}$/) } });
    expect(JSON.stringify(deleteMany.mock.calls)).not.toContain('Sensitive@Example.com');
  });
});
