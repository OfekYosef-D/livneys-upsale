import { AuthTokenType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMany = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const findUnique = vi.hoisted(() => vi.fn());
const userUpdate = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn(async (callback: (tx: unknown) => unknown) => callback({
  authToken: { updateMany, create, findUnique },
  user: { update: userUpdate },
})));
vi.mock('../../lib/db', () => ({ prisma: { $transaction: transaction, authToken: { findUnique } } }));

const { assertPasswordTokenUsable, consumePasswordToken, issueAuthToken, InvalidAuthTokenError } = await import('./tokens');

describe('one-time password tokens', () => {
  beforeEach(() => {
    updateMany.mockReset(); create.mockReset(); findUnique.mockReset(); userUpdate.mockReset(); transaction.mockClear();
  });

  it('persists only a hash and gives setup links a 24-hour expiry', async () => {
    create.mockImplementation(async ({ data }) => ({ id: 'token-1', ...data }));
    const now = new Date('2026-08-11T12:00:00.000Z');
    const result = await issueAuthToken({ userId: 'user-1', type: AuthTokenType.PASSWORD_SETUP, baseUrl: 'https://example.com', now });
    const persisted = create.mock.calls[0][0].data;
    expect(persisted.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted.tokenHash).not.toBe(result.rawToken);
    expect(JSON.stringify(persisted)).not.toContain(result.rawToken);
    expect(result.url).toBe(`https://example.com/setup-password?token=${result.rawToken}`);
    expect(result.expiresAt).toEqual(new Date('2026-08-12T12:00:00.000Z'));
  });

  it('claims a valid token once and revokes all existing sessions', async () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    findUnique.mockResolvedValue({
      id: 'token-1', userId: 'user-1', type: AuthTokenType.PASSWORD_RESET, usedAt: null,
      expiresAt: new Date('2026-08-11T12:20:00.000Z'),
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-1', isActive: true, customer: { isActive: true } },
    });
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await expect(consumePasswordToken({ token: 'raw-token', type: AuthTokenType.PASSWORD_RESET, passwordHash: 'new-hash', now })).resolves.toMatchObject({ userId: 'user-1' });
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sessionVersion: { increment: 1 }, passwordHash: 'new-hash' }) }));
  });

  it('cheaply validates token eligibility before password hashing starts', async () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    findUnique.mockResolvedValue({
      id: 'token-1', userId: 'user-1', type: AuthTokenType.PASSWORD_RESET, usedAt: null,
      expiresAt: new Date('2026-08-11T12:20:00.000Z'),
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-1', isActive: true, customer: { isActive: true } },
    });

    await expect(assertPasswordTokenUsable({
      token: 'raw-token', type: AuthTokenType.PASSWORD_RESET, now,
    })).resolves.toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    }));
  });

  it('rejects expired or already used tokens without changing a password', async () => {
    findUnique.mockResolvedValue({
      id: 'token-1', userId: 'user-1', type: AuthTokenType.PASSWORD_RESET, usedAt: new Date(),
      expiresAt: new Date('2026-08-11T11:00:00.000Z'),
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-1', isActive: true, customer: { isActive: true } },
    });
    await expect(consumePasswordToken({ token: 'used', type: AuthTokenType.PASSWORD_RESET, passwordHash: 'new', now: new Date('2026-08-11T12:00:00.000Z') })).rejects.toBeInstanceOf(InvalidAuthTokenError);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
