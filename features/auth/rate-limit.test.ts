import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMock } from '@/test/prisma-mock';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());

const { prisma } = await import('@/lib/db');
const db = asMock(prisma);
const { actionError } = await import('@/lib/action-result');
const { consumeRateLimit, clearRateLimit, RateLimitError } = await import('./rate-limit');

describe('authentication rate limiting', () => {
  beforeEach(() => db.$reset());

  it('returns remaining attempts from the atomic database counter using the scope policy', async () => {
    db.$queryRaw.mockResolvedValue([{ count: 2, blockedUntil: null }]);
    const now = new Date('2026-08-11T12:00:00.000Z');
    // login-account policy allows 8 attempts per window.
    await expect(consumeRateLimit('login-account', 'Email@example.com', now)).resolves.toEqual({ remaining: 6 });
    expect(db.rateLimitBucket.deleteMany).toHaveBeenCalledWith({
      where: { updatedAt: { lt: new Date('2026-08-10T12:00:00.000Z') } },
    });
  });

  it('never sends the raw identifier to the database', async () => {
    db.$queryRaw.mockResolvedValue([{ count: 1, blockedUntil: null }]);
    await consumeRateLimit('password-reset-account', 'Sensitive@Example.com');
    expect(JSON.stringify(db.$queryRaw.mock.calls).toLowerCase()).not.toContain('sensitive@example.com');
  });

  it('surfaces a safe RATE_LIMITED error once blocked', async () => {
    db.$queryRaw.mockResolvedValue([{ count: 9, blockedUntil: new Date(Date.now() + 60_000) }]);
    const promise = consumeRateLimit('login-account', 'same');
    await expect(promise).rejects.toBeInstanceOf(RateLimitError);
    await expect(promise).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(actionError(new RateLimitError())).toEqual({
      ok: false, code: 'RATE_LIMITED', error: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
    });
  });

  it('fails closed when the counter returns no row', async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(consumeRateLimit('registration-ip', '1.2.3.4')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('allows the request once an earlier block has expired', async () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    db.$queryRaw.mockResolvedValue([{ count: 1, blockedUntil: new Date('2026-08-11T11:00:00.000Z') }]);
    // login-ip policy allows 40 attempts per window.
    await expect(consumeRateLimit('login-ip', '1.2.3.4', now)).resolves.toEqual({ remaining: 39 });
  });

  it('clears only the hashed scoped key after successful login', async () => {
    await clearRateLimit('login-account', 'Sensitive@Example.com');
    expect(db.rateLimitBucket.deleteMany).toHaveBeenCalledWith({ where: { key: expect.stringMatching(/^login-account:[a-f0-9]{64}$/) } });
    expect(JSON.stringify(db.rateLimitBucket.deleteMany.mock.calls)).not.toContain('Sensitive@Example.com');
  });
});
